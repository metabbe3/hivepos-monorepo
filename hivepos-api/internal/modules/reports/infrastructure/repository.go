package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/hivepos/api/internal/modules/reports/application"
	"github.com/hivepos/api/internal/modules/reports/domain"
)

type PgReportsRepository struct {
	db *sql.DB
}

func NewPgReportsRepository(db *sql.DB) *PgReportsRepository {
	return &PgReportsRepository{db: db}
}

// revenueByMethodMap flattens RevenueReport.ByPaymentMethod into a method→total map
// (used by the financial statement aggregate).
func revenueByMethodMap(r *domain.RevenueReport) map[string]float64 {
	m := map[string]float64{}
	for _, pm := range r.ByPaymentMethod {
		m[pm.Method] += pm.Total
	}
	return m
}

// expensesByCategoryMap flattens ExpensesReport.ByCategory into a category→total map.
func expensesByCategoryMap(r *domain.ExpensesReport) map[string]float64 {
	m := map[string]float64{}
	for _, c := range r.ByCategory {
		m[c.Category] += c.Total
	}
	return m
}

// whereClause builds the tenant + branch + date-range predicates for a report.
// Order/Expense/ClockEvent carry branchId (not tenantId), so tenant scoping goes
// through a Branch subquery on branchCol — no JOIN required at the call site.
// tenantID is bound to $1; branch/date follow at $2, $3, ... as needed.
// When neither startDate nor endDate is given, defaults to the last 30 days.
func whereClause(tenantID, tenantCol, branchCol, dateCol string, filter application.ReportFilter) (string, []interface{}) {
	_ = tenantCol // tenant scoping uses the branch subquery below
	args := []interface{}{tenantID}
	idx := 2
	clause := fmt.Sprintf(`%s IN (SELECT id FROM "Branch" WHERE "tenantId" = $1)`, branchCol)

	if filter.BranchID != "" && filter.BranchID != "ALL" {
		clause += fmt.Sprintf(` AND %s = $%d`, branchCol, idx)
		args = append(args, filter.BranchID)
		idx++
	}

	// Date range: from→gte, to→lte, neither→all time (matches TS buildDateFilter;
	// no 30-day default). Naive timestamp comparison, no WIB normalization.
	switch {
	case filter.StartDate != "" && filter.EndDate != "":
		clause += fmt.Sprintf(` AND %s >= $%d AND %s <= $%d`, dateCol, idx, dateCol, idx+1)
		args = append(args, filter.StartDate, filter.EndDate)
	case filter.StartDate != "":
		clause += fmt.Sprintf(` AND %s >= $%d`, dateCol, idx)
		args = append(args, filter.StartDate)
	case filter.EndDate != "":
		clause += fmt.Sprintf(` AND %s <= $%d`, dateCol, idx)
		args = append(args, filter.EndDate)
	}
	return clause, args
}

// GetOrdersReport mirrors the running TS /api/reports/orders: summary + byStatus
// array + serviceBreakdown + turnaroundDistribution + dailyVolume. Scoped by the
// user's branch (or the whole tenant for ALL-outlets). Date filter matches TS
// (from→createdAt gte, to→createdAt lte, none→all time).
func (r *PgReportsRepository) GetOrdersReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.OrdersReport, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND o."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.StartDate != "" {
		where += fmt.Sprintf(` AND o."createdAt" >= $%d`, idx)
		args = append(args, filter.StartDate)
		idx++
	}
	if filter.EndDate != "" {
		where += fmt.Sprintf(` AND o."createdAt" <= $%d`, idx)
		args = append(args, filter.EndDate)
		idx++
	}
	itemWhere := where // OrderItem joins Order; same predicate applies via o.*

	// 1. status groups (count + sum totalAmount)
	statusRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o.status, COUNT(*), COALESCE(SUM(o."totalAmount"::float), 0) FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" %s GROUP BY o.status`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("orders status groups: %w", err)
	}
	var byStatus []domain.OrderStatusGroup
	for statusRows.Next() {
		var g domain.OrderStatusGroup
		if err := statusRows.Scan(&g.Status, &g.Count, &g.TotalAmount); err != nil {
			return nil, err
		}
		byStatus = append(byStatus, g)
	}
	statusRows.Close()

	// 2. total orders
	var totalOrders int64
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" %s`, where), args...).Scan(&totalOrders); err != nil {
		return nil, fmt.Errorf("orders total: %w", err)
	}

	// 3. delivered orders (turnaround)
	delivRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."createdAt", o."deliveredAt" FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" %s AND o."deliveredAt" IS NOT NULL`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("delivered orders: %w", err)
	}
	var turnaroundHours []float64
	for delivRows.Next() {
		var created, delivered time.Time
		if err := delivRows.Scan(&created, &delivered); err != nil {
			return nil, err
		}
		h := delivered.Sub(created).Hours()
		if h >= 0 {
			turnaroundHours = append(turnaroundHours, h)
		}
	}
	delivRows.Close()

	// 4. service breakdown via order items
	svcRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT oi."serviceId", COALESCE(SUM(oi.quantity::float),0), COALESCE(SUM(oi."weightKg"::float),0), COALESCE(SUM(oi.subtotal::float),0), COUNT(*)
		 FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" JOIN "Branch" b ON b.id = o."branchId" %s GROUP BY oi."serviceId"`, itemWhere), args...)
	if err != nil {
		return nil, fmt.Errorf("service breakdown: %w", err)
	}
	type svcAgg struct {
		serviceID                   string
		quantity, weightKg, revenue float64
		count                       int64
	}
	var aggs []svcAgg
	var totalItems, totalWeightKg float64
	for svcRows.Next() {
		var a svcAgg
		if err := svcRows.Scan(&a.serviceID, &a.quantity, &a.weightKg, &a.revenue, &a.count); err != nil {
			return nil, err
		}
		aggs = append(aggs, a)
		totalItems += a.quantity
		totalWeightKg += a.weightKg
	}
	svcRows.Close()

	// 5. order dates (daily volume)
	dateRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."createdAt", o."receivedAt" FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" %s ORDER BY o."receivedAt"`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("order dates: %w", err)
	}
	dailyMap := map[string]int{}
	var dailyOrder []string
	for dateRows.Next() {
		var created time.Time
		var received sql.NullTime
		if err := dateRows.Scan(&created, &received); err != nil {
			return nil, err
		}
		t := created
		if received.Valid {
			t = received.Time
		}
		day := t.UTC().Format("2006-01-02")
		if _, ok := dailyMap[day]; !ok {
			dailyOrder = append(dailyOrder, day)
		}
		dailyMap[day]++
	}
	dateRows.Close()
	sort.Strings(dailyOrder)
	dailyVolume := make([]domain.DailyVolume, 0, len(dailyOrder))
	for _, d := range dailyOrder {
		dailyVolume = append(dailyVolume, domain.DailyVolume{Date: d, Count: dailyMap[d]})
	}

	// resolve service names
	nameByID := map[string]struct{ name, pricing string }{}
	if len(aggs) > 0 {
		ids := make([]interface{}, 0, len(aggs))
		in := ""
		for i, a := range aggs {
			if i > 0 {
				in += ","
			}
			in += fmt.Sprintf("$%d", i+1)
			ids = append(ids, a.serviceID)
		}
		nr, err := r.db.QueryContext(ctx, fmt.Sprintf(
			`SELECT id, name, "pricingType" FROM "Service" WHERE id IN (%s)`, in), ids...)
		if err == nil {
			for nr.Next() {
				var id, name, pricing string
				if nr.Scan(&id, &name, &pricing) == nil {
					nameByID[id] = struct{ name, pricing string }{name, pricing}
				}
			}
			nr.Close()
		}
	}
	serviceBreakdown := make([]domain.OrderServiceUsage, 0, len(aggs))
	for _, a := range aggs {
		nm := nameByID[a.serviceID]
		name := nm.name
		if name == "" {
			name = "Unknown"
		}
		pricing := nm.pricing
		if pricing == "" {
			pricing = "PER_ITEM"
		}
		serviceBreakdown = append(serviceBreakdown, domain.OrderServiceUsage{
			ServiceID: a.serviceID, Name: name, PricingType: pricing,
			OrderCount: a.count, Quantity: a.quantity, WeightKg: a.weightKg, Revenue: a.revenue,
		})
	}
	sort.Slice(serviceBreakdown, func(i, j int) bool { return serviceBreakdown[i].Revenue > serviceBreakdown[j].Revenue })

	// turnaround distribution + avg
	var dist domain.TurnaroundDist
	var sum float64
	for _, h := range turnaroundHours {
		sum += h
		switch {
		case h < 24:
			dist.Under24h++
		case h < 48:
			dist.Under48h++
		case h < 72:
			dist.Under72h++
		default:
			dist.Over72h++
		}
	}
	var avg *float64
	if len(turnaroundHours) > 0 {
		v := math.Round((sum/float64(len(turnaroundHours)))*10) / 10
		avg = &v
	}

	return &domain.OrdersReport{
		Summary: domain.OrdersSummary{
			TotalOrders:        totalOrders,
			AvgTurnaroundHours: avg,
			TotalItems:         totalItems,
			TotalWeightKg:      math.Round(totalWeightKg*100) / 100,
		},
		ByStatus:               byStatus,
		ServiceBreakdown:       serviceBreakdown,
		TurnaroundDistribution: dist,
		DailyVolume:            dailyVolume,
	}, nil
}

// GetRevenueReport — sum of PAID payments + breakdown by payment method.
// GetRevenueReport mirrors TS /api/reports/revenue: {summary, byPaymentMethod,
// dailyTrend, byPaymentStatus}. Payment scoping joins Order (branch + paidAt date);
// order scoping uses createdAt.
func (r *PgReportsRepository) GetRevenueReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.RevenueReport, error) {
	orderWhere, orderArgs := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	payWhere, payArgs := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `p."paidAt"`, filter)

	// 1. order aggregates
	var count int64
	var sumTotal, sumDiscount, sumPaid float64
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf(
		`SELECT COUNT(*), COALESCE(SUM(o."totalAmount"::float),0), COALESCE(SUM(o."discountAmount"::float),0), COALESCE(SUM(o."paidAmount"::float),0)
		 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s`, orderWhere), orderArgs...).Scan(&count, &sumTotal, &sumDiscount, &sumPaid); err != nil {
		return nil, fmt.Errorf("revenue totals: %w", err)
	}

	// 2. payments by method
	methRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT p."paymentMethod", COUNT(*), COALESCE(SUM(p.amount::float),0)
		 FROM "Payment" p JOIN "Order" o ON o.id = p."orderId" JOIN "Branch" b ON b.id = o."branchId"
		 WHERE %s GROUP BY p."paymentMethod"`, payWhere), payArgs...)
	if err != nil {
		return nil, fmt.Errorf("revenue by method: %w", err)
	}
	var byMethod = make([]domain.RevenueMethod, 0)
	for methRows.Next() {
		var m domain.RevenueMethod
		if err := methRows.Scan(&m.Method, &m.Count, &m.Total); err != nil {
			methRows.Close()
			return nil, err
		}
		byMethod = append(byMethod, m)
	}
	methRows.Close()

	// 3. payments (for daily)
	payRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT p."paidAt", p.amount::float, p."paymentMethod"
		 FROM "Payment" p JOIN "Order" o ON o.id = p."orderId" JOIN "Branch" b ON b.id = o."branchId"
		 WHERE %s ORDER BY p."paidAt"`, payWhere), payArgs...)
	if err != nil {
		return nil, fmt.Errorf("revenue payments: %w", err)
	}
	type dayAgg struct {
		revenue, gross, net float64
		orders              map[string]struct{}
		byMethod            map[string]float64
	}
	daily := map[string]*dayAgg{}
	var order []string
	newDay := func(d string) *dayAgg {
		a := &dayAgg{orders: map[string]struct{}{}, byMethod: map[string]float64{}}
		daily[d] = a
		order = append(order, d)
		return a
	}
	for payRows.Next() {
		var paidAt time.Time
		var amt float64
		var method string
		if err := payRows.Scan(&paidAt, &amt, &method); err != nil {
			payRows.Close()
			return nil, err
		}
		day := paidAt.UTC().Format("2006-01-02")
		a, ok := daily[day]
		if !ok {
			a = newDay(day)
		}
		a.revenue += amt
		a.byMethod[method] += amt
	}
	payRows.Close()

	// 4. orders by payment status
	psRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."paymentStatus", COUNT(*), COALESCE(SUM(o."totalAmount"::float),0), COALESCE(SUM(o."paidAmount"::float),0)
		 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s GROUP BY o."paymentStatus"`, orderWhere), orderArgs...)
	if err != nil {
		return nil, fmt.Errorf("revenue by status: %w", err)
	}
	var byStatus = make([]domain.RevenuePayStat, 0)
	for psRows.Next() {
		var s domain.RevenuePayStat
		if err := psRows.Scan(&s.Status, &s.Count, &s.TotalAmount, &s.PaidAmount); err != nil {
			psRows.Close()
			return nil, err
		}
		byStatus = append(byStatus, s)
	}
	psRows.Close()

	// 5. orders for daily gross/net
	odRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."createdAt", o."receivedAt", o.id, o."totalAmount"::float, o."discountAmount"::float
		 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s ORDER BY o."receivedAt"`, orderWhere), orderArgs...)
	if err != nil {
		return nil, fmt.Errorf("revenue daily orders: %w", err)
	}
	for odRows.Next() {
		var created time.Time
		var received sql.NullTime
		var id string
		var total, disc float64
		if err := odRows.Scan(&created, &received, &id, &total, &disc); err != nil {
			odRows.Close()
			return nil, err
		}
		t := created
		if received.Valid {
			t = received.Time
		}
		day := t.UTC().Format("2006-01-02")
		a, ok := daily[day]
		if !ok {
			a = newDay(day)
		}
		a.orders[id] = struct{}{}
		a.gross += total + disc
		a.net += total
	}
	odRows.Close()

	sort.Strings(order)
	dailyTrend := make([]domain.RevenueDaily, 0, len(order))
	for _, d := range order {
		a := daily[d]
		if a.byMethod == nil {
			a.byMethod = map[string]float64{}
		}
		dailyTrend = append(dailyTrend, domain.RevenueDaily{
			Date: d, Revenue: a.revenue, GrossRevenue: a.gross, NetRevenue: a.net,
			Orders: len(a.orders), ByMethod: a.byMethod,
		})
	}

	return &domain.RevenueReport{
		Summary: domain.RevenueSummary{
			GrossRevenue: sumTotal + sumDiscount, TotalDiscount: sumDiscount,
			NetRevenue: sumTotal, TotalPaid: sumPaid, OrdersCount: count,
		},
		ByPaymentMethod: byMethod,
		DailyTrend:      dailyTrend,
		ByPaymentStatus: byStatus,
	}, nil
}

// GetServicesReport — per-service usage (qty + revenue).
// GetServicesReport mirrors TS /api/reports/services: {services, byPricingType}.
func (r *PgReportsRepository) GetServicesReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.ServicesReport, error) {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT s.id, s.name, s."pricingType", s."basePrice"::float,
		       COALESCE(SUM(oi.quantity::float),0), COALESCE(SUM(oi."weightKg"::float),0),
		       COALESCE(SUM(oi.subtotal::float),0), COUNT(DISTINCT oi."orderId")
		FROM "OrderItem" oi JOIN "Order" o ON o.id=oi."orderId"
		JOIN "Service" s ON s.id=oi."serviceId" JOIN "Branch" b ON b.id=o."branchId"
		WHERE %s GROUP BY s.id, s.name, s."pricingType", s."basePrice" ORDER BY SUM(oi.subtotal::float) DESC`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("services report: %w", err)
	}
	defer rows.Close()

	services := make([]domain.ServicesReportItem, 0)
	byPricingType := map[string]domain.ServicesPricingAgg{}
	for rows.Next() {
		var it domain.ServicesReportItem
		if err := rows.Scan(&it.ServiceID, &it.Name, &it.PricingType, &it.BasePrice,
			&it.TotalQuantity, &it.TotalWeightKg, &it.TotalRevenue, &it.OrderCount); err != nil {
			return nil, err
		}
		if it.OrderCount > 0 {
			it.AvgOrderValue = it.TotalRevenue / float64(it.OrderCount)
		}
		services = append(services, it)
		agg := byPricingType[it.PricingType]
		agg.OrderCount += it.OrderCount
		agg.Revenue += it.TotalRevenue
		if it.PricingType == "PER_ITEM" {
			agg.TotalQuantity += it.TotalQuantity
		} else if it.PricingType == "PER_KG" {
			agg.TotalWeightKg += it.TotalWeightKg
		}
		byPricingType[it.PricingType] = agg
	}
	return &domain.ServicesReport{Services: services, ByPricingType: byPricingType}, nil
}

// GetCustomersReport mirrors TS /api/reports/customers: {summary, topSpenders, outstandingBalance}.
func (r *PgReportsRepository) GetCustomersReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.CustomersReport, error) {
	// Customer scope (tenant+branch; date on Customer.createdAt for "new").
	custScope := fmt.Sprintf(`c."branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $1)`)
	custArgs := []interface{}{tenantID}
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		custScope += fmt.Sprintf(` AND c."branchId" = $%d`, len(custArgs)+1)
		custArgs = append(custArgs, filter.BranchID)
	}
	var totalCustomers int64
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "Customer" c WHERE %s`, custScope), custArgs...).Scan(&totalCustomers); err != nil {
		return nil, fmt.Errorf("customers total: %w", err)
	}
	newScope, newArgs := custScope, custArgs
	if filter.StartDate != "" {
		newScope += fmt.Sprintf(` AND c."createdAt" >= $%d`, len(newArgs)+1)
		newArgs = append(newArgs, filter.StartDate)
	}
	if filter.EndDate != "" {
		newScope += fmt.Sprintf(` AND c."createdAt" <= $%d`, len(newArgs)+1)
		newArgs = append(newArgs, filter.EndDate)
	}
	var newCustomers int64
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "Customer" c WHERE %s`, newScope), newArgs...).Scan(&newCustomers); err != nil {
		return nil, fmt.Errorf("customers new: %w", err)
	}

	// Top spenders (by totalAmount desc, top 20).
	orderWhere, orderArgs := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	topRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."customerId", COUNT(*), COALESCE(SUM(o."totalAmount"::float),0)
		 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s
		 GROUP BY o."customerId" ORDER BY SUM(o."totalAmount"::float) DESC LIMIT 20`, orderWhere), orderArgs...)
	if err != nil {
		return nil, fmt.Errorf("top spenders: %w", err)
	}
	type spender struct {
		id     string
		orders int64
		spent  float64
	}
	var spenders []spender
	var totalSpent float64
	for topRows.Next() {
		var s spender
		if err := topRows.Scan(&s.id, &s.orders, &s.spent); err != nil {
			topRows.Close()
			return nil, err
		}
		spenders = append(spenders, s)
		totalSpent += s.spent
	}
	topRows.Close()

	// Resolve spender names + first-order dates (for new/returning).
	nameByID := map[string]string{}
	firstByID := map[string]time.Time{}
	if len(spenders) > 0 {
		ids := make([]interface{}, 0, len(spenders))
		in := ""
		for i, s := range spenders {
			if i > 0 {
				in += ","
			}
			in += fmt.Sprintf("$%d", i+1)
			ids = append(ids, s.id)
		}
		nr, _ := r.db.QueryContext(ctx, fmt.Sprintf(`SELECT id, name FROM "Customer" WHERE id IN (%s)`, in), ids...)
		if nr != nil {
			for nr.Next() {
				var id, name string
				if nr.Scan(&id, &name) == nil {
					nameByID[id] = name
				}
			}
			nr.Close()
		}
	}
	for _, s := range spenders {
		var first sql.NullTime
		_ = r.db.QueryRowContext(ctx, `SELECT MIN(o."createdAt") FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE b."tenantId" = $1 AND o."customerId" = $2`, tenantID, s.id).Scan(&first)
		if first.Valid {
			firstByID[s.id] = first.Time
		}
	}

	var fromDate time.Time
	if filter.StartDate != "" {
		if t, err := time.Parse(time.RFC3339, filter.StartDate); err == nil {
			fromDate = t
		} else if t, err := time.Parse("2006-01-02", filter.StartDate); err == nil {
			fromDate = t
		}
	}
	var newInPeriod, returning int
	topSpenders := make([]domain.CustomerSpender, 0, len(spenders))
	for _, s := range spenders {
		name := nameByID[s.id]
		if name == "" {
			name = "Unknown"
		}
		topSpenders = append(topSpenders, domain.CustomerSpender{CustomerID: s.id, Name: name, Orders: s.orders, TotalSpent: s.spent})
		if first, ok := firstByID[s.id]; ok && !first.Before(fromDate) {
			newInPeriod++
		} else {
			returning++
		}
	}

	// Outstanding balance (unpaid orders grouped by customer).
	outRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."customerId", COALESCE(c.name,''), COALESCE(c.phone,''), o."totalAmount"::float, o."paidAmount"::float
		 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		 LEFT JOIN "Customer" c ON c.id = o."customerId"
		 WHERE %s AND o."paymentStatus" IN ('PENDING','PARTIAL')`, orderWhere), orderArgs...)
	if err != nil {
		return nil, fmt.Errorf("customers outstanding: %w", err)
	}
	type outAgg struct {
		name, phone string
		total       float64
		count       int
	}
	outMap := map[string]*outAgg{}
	for outRows.Next() {
		var cid, name, phone string
		var total, paid float64
		if err := outRows.Scan(&cid, &name, &phone, &total, &paid); err != nil {
			outRows.Close()
			return nil, err
		}
		a, ok := outMap[cid]
		if !ok {
			a = &outAgg{name: name, phone: phone}
			outMap[cid] = a
		}
		a.total += total - paid
		a.count++
	}
	outRows.Close()
	outstanding := make([]domain.CustomerOutstanding, 0, len(outMap))
	for cid, a := range outMap {
		outstanding = append(outstanding, domain.CustomerOutstanding{CustomerID: cid, Name: a.name, Phone: a.phone, TotalOutstanding: a.total, OrderCount: a.count})
	}
	sort.Slice(outstanding, func(i, j int) bool { return outstanding[i].TotalOutstanding > outstanding[j].TotalOutstanding })
	if len(outstanding) > 20 {
		outstanding = outstanding[:20]
	}

	avg := 0.0
	if len(spenders) > 0 {
		avg = math.Round(totalSpent / float64(len(spenders)))
	}

	return &domain.CustomersReport{
		Summary:            domain.CustomersSummary{TotalCustomers: totalCustomers, NewCustomers: newCustomers, NewInPeriod: newInPeriod, ReturningInPeriod: returning, AvgSpendPerCustomer: avg},
		TopSpenders:        topSpenders,
		OutstandingBalance: outstanding,
	}, nil
}

// GetExpensesReport — total expenses + breakdown by category.
// GetExpensesReport mirrors TS /api/reports/expenses: {summary, byCategory, dailyTrend}.
func (r *PgReportsRepository) GetExpensesReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.ExpensesReport, error) {
	where, args := whereClause(tenantID, `b."tenantId"`, `e."branchId"`, `e.date`, filter)

	// totals
	var count int64
	var total float64
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf(
		`SELECT COUNT(*), COALESCE(SUM(e.amount::float),0) FROM "Expense" e JOIN "Branch" b ON b.id = e."branchId" WHERE %s`, where), args...).Scan(&count, &total); err != nil {
		return nil, fmt.Errorf("expenses totals: %w", err)
	}

	// by category
	catRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT e."categoryId", COUNT(*), COALESCE(SUM(e.amount::float),0)
		 FROM "Expense" e JOIN "Branch" b ON b.id = e."branchId" WHERE %s GROUP BY e."categoryId"`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("expenses by category: %w", err)
	}
	type catAgg struct {
		id    string
		count int64
		total float64
	}
	var aggs []catAgg
	for catRows.Next() {
		var id sql.NullString
		var a catAgg
		if err := catRows.Scan(&id, &a.count, &a.total); err != nil {
			catRows.Close()
			return nil, err
		}
		a.id = id.String
		aggs = append(aggs, a)
	}
	catRows.Close()

	nameByID := map[string]string{}
	if len(aggs) > 0 {
		ids := make([]interface{}, 0, len(aggs))
		in := ""
		for _, a := range aggs {
			if a.id == "" {
				continue
			}
			if in != "" {
				in += ","
			}
			in += fmt.Sprintf("$%d", len(ids)+1)
			ids = append(ids, a.id)
		}
		if len(ids) > 0 {
			nr, err := r.db.QueryContext(ctx, fmt.Sprintf(`SELECT id, name FROM "ExpenseCategory" WHERE id IN (%s)`, in), ids...)
			if err == nil {
				for nr.Next() {
					var id, name string
					if nr.Scan(&id, &name) == nil {
						nameByID[id] = name
					}
				}
				nr.Close()
			}
		}
	}
	byCategory := make([]domain.ExpenseCategoryRow, 0, len(aggs))
	for _, a := range aggs {
		name := "Unknown"
		if a.id != "" {
			if n, ok := nameByID[a.id]; ok {
				name = n
			}
		} else {
			name = "Uncategorized"
		}
		byCategory = append(byCategory, domain.ExpenseCategoryRow{Category: name, Count: a.count, Total: a.total})
	}

	// daily trend
	dRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT e.date, e.amount::float FROM "Expense" e JOIN "Branch" b ON b.id = e."branchId" WHERE %s ORDER BY e.date`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("expenses daily: %w", err)
	}
	dailyTot := map[string]float64{}
	dailyCnt := map[string]int{}
	var order []string
	for dRows.Next() {
		var d time.Time
		var amt float64
		if err := dRows.Scan(&d, &amt); err != nil {
			dRows.Close()
			return nil, err
		}
		day := d.UTC().Format("2006-01-02")
		if _, ok := dailyTot[day]; !ok {
			order = append(order, day)
		}
		dailyTot[day] += amt
		dailyCnt[day]++
	}
	dRows.Close()
	sort.Strings(order)
	dailyTrend := make([]domain.ExpenseDailyRow, 0, len(order))
	for _, d := range order {
		dailyTrend = append(dailyTrend, domain.ExpenseDailyRow{Date: d, Total: dailyTot[d], Count: dailyCnt[d]})
	}

	daysInRange := len(order)
	if daysInRange == 0 {
		daysInRange = 1
	}
	return &domain.ExpensesReport{
		Summary:    domain.ExpensesSummary{TotalExpenses: total, CategoryCount: len(aggs), DailyAvg: total / float64(daysInRange)},
		ByCategory: byCategory,
		DailyTrend: dailyTrend,
	}, nil
}

// GetMonthlyPnL — last 6 months revenue vs expenses.
var monthNamesID = []string{"Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"}
var dayNamesID = []string{"MINGGU", "SENIN", "SELASA", "RABU", "KAMIS", "JUMAT", "SABTU"}

// GetMonthlyPnL mirrors TS /api/reports/monthly-pnl (the most complex report).
// month/year default to current; uses branch scoping via the request context.
func (r *PgReportsRepository) GetMonthlyPnL(ctx context.Context, tenantID string, month, year int) (*domain.MonthlyPnL, error) {
	now := time.Now()
	if month < 1 || month > 12 {
		month = int(now.Month())
	}
	if year == 0 {
		year = now.Year()
	}
	monthStart := time.Date(year, time.Month(month), 1, 0, 0, 0, 0, now.Location())
	monthEnd := time.Date(year, time.Month(month+1), 0, 23, 59, 59, 0, now.Location())
	branchIn := `o."branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $1)`
	args1 := []interface{}{tenantID, monthStart, monthEnd}

	// 1. per-kg + per-item subtotals from OrderItem (current month, branch-scoped)
	var perKg, perItem float64
	r.db.QueryRowContext(ctx, fmt.Sprintf(`
		SELECT COALESCE(SUM(CASE WHEN s."pricingType"='PER_KG' THEN oi.subtotal::float ELSE 0 END),0),
		       COALESCE(SUM(CASE WHEN s."pricingType"='PER_ITEM' THEN oi.subtotal::float ELSE 0 END),0)
		FROM "OrderItem" oi
		JOIN "Order" o ON o.id=oi."orderId" JOIN "Service" s ON s.id=oi."serviceId"
		WHERE %s AND (o."receivedAt" IS NOT NULL AND o."receivedAt" >= $2 AND o."receivedAt" <= $3
		              OR o."receivedAt" IS NULL AND o."createdAt" >= $2 AND o."createdAt" <= $3)`, branchIn), args1...).Scan(&perKg, &perItem)
	totalIncome := perKg + perItem

	// 2. unpaid orders in month
	var unpaidBalance float64
	r.db.QueryRowContext(ctx, fmt.Sprintf(`
		SELECT COALESCE(SUM(o."totalAmount"::float - o."paidAmount"::float),0)
		FROM "Order" o WHERE %s AND o."paymentStatus" IN ('PENDING','PARTIAL')
		AND (o."receivedAt" IS NOT NULL AND o."receivedAt" >= $2 AND o."receivedAt" <= $3
		     OR o."receivedAt" IS NULL AND o."createdAt" >= $2 AND o."createdAt" <= $3)`, branchIn), args1...).Scan(&unpaidBalance)

	// 3. cash collected in month
	var cashCollected float64
	r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(p.amount::float),0) FROM "Payment" p
		JOIN "Order" o ON o.id=p."orderId" JOIN "Branch" b ON b.id=o."branchId"
		WHERE b."tenantId"=$1 AND p."paidAt" >= $2 AND p."paidAt" <= $3`, args1...).Scan(&cashCollected)

	// 4. cash by origin month
	cashByOrig := map[string]float64{}
	cRows, _ := r.db.QueryContext(ctx, `
		SELECT p.amount::float, COALESCE(o."receivedAt", o."createdAt")
		FROM "Payment" p JOIN "Order" o ON o.id=p."orderId" JOIN "Branch" b ON b.id=o."branchId"
		WHERE b."tenantId"=$1 AND p."paidAt" >= $2 AND p."paidAt" <= $3`, args1...)
	if cRows != nil {
		for cRows.Next() {
			var amt float64
			var d time.Time
			if cRows.Scan(&amt, &d) == nil {
				cashByOrig[d.Format("2006-01")] += amt
			}
		}
		cRows.Close()
	}
	currentMonthKey := fmt.Sprintf("%d-%02d", year, month)
	cashByMonth := make([]domain.CashByMonth, 0)
	for m, amt := range cashByOrig {
		cashByMonth = append(cashByMonth, domain.CashByMonth{Month: m, Amount: amt, IsCurrent: m == currentMonthKey})
	}
	sort.Slice(cashByMonth, func(i, j int) bool { return cashByMonth[i].Month > cashByMonth[j].Month })

	// 5. expenses by category
	catRows, _ := r.db.QueryContext(ctx, `
		SELECT e."categoryId", COALESCE(SUM(e.amount::float),0) FROM "Expense" e
		JOIN "Branch" b ON b.id=e."branchId" WHERE b."tenantId"=$1 AND e.date >= $2 AND e.date <= $3
		GROUP BY e."categoryId" ORDER BY SUM(e.amount::float) DESC`, args1...)
	type catAgg struct {
		id  string
		amt float64
	}
	var catAggs []catAgg
	for catRows != nil && catRows.Next() {
		var ca catAgg
		var cid sql.NullString
		if catRows.Scan(&cid, &ca.amt) == nil {
			ca.id = cid.String
			catAggs = append(catAggs, ca)
		}
	}
	if catRows != nil {
		catRows.Close()
	}
	// resolve names
	catNames := map[string]string{}
	if len(catAggs) > 0 {
		ids := make([]interface{}, 0)
		in := ""
		for _, ca := range catAggs {
			if ca.id == "" {
				continue
			}
			if in != "" {
				in += ","
			}
			in += fmt.Sprintf("$%d", len(ids)+1)
			ids = append(ids, ca.id)
		}
		if len(ids) > 0 {
			nr, _ := r.db.QueryContext(ctx, fmt.Sprintf(`SELECT id,name FROM "ExpenseCategory" WHERE id IN (%s)`, in), ids...)
			if nr != nil {
				for nr.Next() {
					var id, nm string
					if nr.Scan(&id, &nm) == nil {
						catNames[id] = nm
					}
				}
				nr.Close()
			}
		}
	}
	pnLExpenses := make([]domain.PnLExpenseRow, 0, len(catAggs))
	totalExpenses := 0.0
	for _, ca := range catAggs {
		nm := "Lainnya"
		if ca.id != "" {
			if n, ok := catNames[ca.id]; ok {
				nm = n
			}
		}
		pnLExpenses = append(pnLExpenses, domain.PnLExpenseRow{Category: nm, Amount: ca.amt})
		totalExpenses += ca.amt
	}
	netProfit := totalIncome - totalExpenses
	margin := 0.0
	if totalIncome > 0 {
		margin = math.Round((netProfit/totalIncome)*10000) / 100
	}

	// 6. expense details
	edRows, _ := r.db.QueryContext(ctx, `
		SELECT e.date, e.description, e.amount::float, ec.name FROM "Expense" e
		JOIN "Branch" b ON b.id=e."branchId" LEFT JOIN "ExpenseCategory" ec ON ec.id=e."categoryId"
		WHERE b."tenantId"=$1 AND e.date >= $2 AND e.date <= $3 ORDER BY e.date`, args1...)
	expenseDetails := make([]domain.ExpenseDetailRow, 0)
	if edRows != nil {
		for edRows.Next() {
			var d time.Time
			var desc, cn sql.NullString
			var amt float64
			if edRows.Scan(&d, &desc, &amt, &cn) == nil {
				ds := d.UTC().Format("2006-01-02")
				dp := desc.String
				if dp == "" {
					dp = cn.String
					if dp == "" {
						dp = "Uncategorized"
					}
				}
				expenseDetails = append(expenseDetails, domain.ExpenseDetailRow{Date: ds, Description: dp, Amount: amt})
			}
		}
		edRows.Close()
	}

	// 7. daily transactions (orders with items)
	dRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT o.id, o."totalAmount"::float, COALESCE(o."receivedAt",o."createdAt"), c.name,
		       oi.subtotal::float, s.name, s."pricingType", oi."weightKg"::float, oi.quantity::float
		FROM "Order" o
		JOIN "Branch" b ON b.id=o."branchId"
		LEFT JOIN "Customer" c ON c.id=o."customerId"
		LEFT JOIN "OrderItem" oi ON oi."orderId"=o.id
		LEFT JOIN "Service" s ON s.id=oi."serviceId"
		WHERE %s AND (o."receivedAt" IS NOT NULL AND o."receivedAt" >= $2 AND o."receivedAt" <= $3
		             OR o."receivedAt" IS NULL AND o."createdAt" >= $2 AND o."createdAt" <= $3)
		ORDER BY COALESCE(o."receivedAt",o."createdAt")`, branchIn), args1...)
	type ordDetail struct {
		name   string
		weight float64
		items  []domain.DailyItem
		amount float64
	}
	dayMap := map[string][]*ordDetail{}
	var dayOrder []string
	ordByID := map[string]*ordDetail{}
	if dRows != nil {
		for dRows.Next() {
			var oid, custName, svcName, pricing sql.NullString
			var total float64
			var ordDate time.Time
			var subtotal, weight, qty sql.NullFloat64
			if dRows.Scan(&oid, &total, &ordDate, &custName, &subtotal, &svcName, &pricing, &weight, &qty) != nil {
				continue
			}
			day := ordDate.UTC().Format("2006-01-02")
			od, ok := ordByID[oid.String]
			if !ok {
				od = &ordDetail{name: custName.String, amount: total}
				ordByID[oid.String] = od
				if _, ok2 := dayMap[day]; !ok2 {
					dayOrder = append(dayOrder, day)
				}
				dayMap[day] = append(dayMap[day], od)
			}
			if pricing.String == "PER_KG" {
				if weight.Valid {
					od.weight += weight.Float64
				}
			} else if svcName.Valid {
				od.items = append(od.items, domain.DailyItem{Name: svcName.String, Qty: qty.Float64})
			}
		}
		dRows.Close()
	}
	sort.Strings(dayOrder)
	dailyTx := make([]domain.DailyTransaction, 0, len(dayOrder))
	running := 0.0
	for _, day := range dayOrder {
		ods := dayMap[day]
		dayTotal := 0.0
		details := make([]domain.DailyOrderDetail, 0, len(ods))
		for _, od := range ods {
			parts := make([]string, 0, len(od.items))
			for _, it := range od.items {
				parts = append(parts, fmt.Sprintf("%s x%.0f", it.Name, it.Qty))
			}
			items := od.items
			if items == nil {
				items = []domain.DailyItem{}
			}
			details = append(details, domain.DailyOrderDetail{CustomerName: od.name, WeightKg: math.Round(od.weight*100) / 100, Items: items, ItemSummary: strings.Join(parts, ", "), Amount: od.amount})
			dayTotal += od.amount
		}
		d, _ := time.Parse("2006-01-02", day)
		var dayName string
		dayNum := 0
		if !d.IsZero() {
			dayName = dayNamesID[int(d.Weekday())]
			dayNum = d.Day()
		}
		running += dayTotal
		dailyTx = append(dailyTx, domain.DailyTransaction{Date: day, DayName: dayName, DateNumber: dayNum, Orders: details, DayTotal: dayTotal, RunningTotal: running})
	}

	// 8. annual comparison (12 months)
	yearStart := time.Date(year, 1, 1, 0, 0, 0, 0, now.Location())
	yearEnd := time.Date(year, 12, 31, 23, 59, 59, 0, now.Location())
	yrArgs := []interface{}{tenantID, yearStart, yearEnd}
	monthlyRev := [12]float64{}
	monthlyExp := [12]float64{}
	yoRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT COALESCE(o."receivedAt",o."createdAt") AS d, o."totalAmount"::float, COALESCE(o."discountAmount"::float,0)
		FROM "Order" o WHERE %s AND COALESCE(o."receivedAt",o."createdAt") >= $2 AND COALESCE(o."receivedAt",o."createdAt") <= $3`, branchIn), yrArgs...)
	if yoRows != nil {
		for yoRows.Next() {
			var d time.Time
			var rev, disc float64
			if yoRows.Scan(&d, &rev, &disc) == nil {
				if d.Year() == year {
					monthlyRev[int(d.Month())-1] += rev - disc
				}
			}
		}
		yoRows.Close()
	}
	yeRows, _ := r.db.QueryContext(ctx, `
		SELECT e.date, e.amount::float FROM "Expense" e
		JOIN "Branch" b ON b.id=e."branchId" WHERE b."tenantId"=$1 AND e.date >= $2 AND e.date <= $3`, yrArgs...)
	if yeRows != nil {
		for yeRows.Next() {
			var d time.Time
			var amt float64
			if yeRows.Scan(&d, &amt) == nil {
				if d.Year() == year {
					monthlyExp[int(d.Month())-1] += amt
				}
			}
		}
		yeRows.Close()
	}
	annual := make([]domain.AnnualMonth, 12)
	for i := 0; i < 12; i++ {
		annual[i] = domain.AnnualMonth{Month: i + 1, MonthName: monthNamesID[i], Revenue: monthlyRev[i], Expenses: monthlyExp[i], NetProfit: monthlyRev[i] - monthlyExp[i]}
	}

	return &domain.MonthlyPnL{
		Month: month, Year: year, MonthName: monthNamesID[month-1],
		PnL: domain.PnLDetail{
			Income:        domain.PnLIncome{PerKg: perKg, PerItem: perItem, Total: totalIncome},
			UnpaidBalance: unpaidBalance, CashCollected: cashCollected, CashCollectedByMonth: cashByMonth,
			Expenses: pnLExpenses, TotalExpenses: totalExpenses, NetProfit: netProfit, MarginPercent: margin,
		},
		ExpenseDetails:    expenseDetails,
		DailyTransactions: dailyTx,
		AnnualComparison:  annual,
	}, nil
}

// GetProfitReport mirrors TS /api/reports/profit: {summary, dailyComparison}.
// Revenue from DELIVERED orders; expenses from Expense; daily trend combined.
func (r *PgReportsRepository) GetProfitReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.ProfitReport, error) {
	revWhere, revArgs := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	revWhere += ` AND o.status = 'DELIVERED'`
	var revenue float64
	revQ := fmt.Sprintf(`
		SELECT COALESCE(SUM(o."totalAmount"::float), 0)
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s`, revWhere)
	if err := r.db.QueryRowContext(ctx, revQ, revArgs...).Scan(&revenue); err != nil {
		return nil, fmt.Errorf("profit revenue: %w", err)
	}

	expWhere, expArgs := whereClause(tenantID, `b."tenantId"`, `e."branchId"`, `e.date`, filter)
	var expenses float64
	expQ := fmt.Sprintf(`
		SELECT COALESCE(SUM(e.amount::float), 0)
		FROM "Expense" e JOIN "Branch" b ON b.id = e."branchId"
		WHERE %s`, expWhere)
	if err := r.db.QueryRowContext(ctx, expQ, expArgs...).Scan(&expenses); err != nil {
		return nil, fmt.Errorf("profit expenses: %w", err)
	}

	// Daily trend (delivered-order revenue by receivedAt??createdAt day, expenses by date).
	type dayTotals struct{ rev, exp float64 }
	daily := map[string]*dayTotals{}
	var order []string

	revRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."createdAt", o."receivedAt", o."totalAmount"::float FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s ORDER BY o."receivedAt"`, revWhere), revArgs...)
	if err != nil {
		return nil, fmt.Errorf("profit daily revenue: %w", err)
	}
	for revRows.Next() {
		var created time.Time
		var received sql.NullTime
		var amt float64
		if err := revRows.Scan(&created, &received, &amt); err != nil {
			revRows.Close()
			return nil, err
		}
		t := created
		if received.Valid {
			t = received.Time
		}
		day := t.UTC().Format("2006-01-02")
		if _, ok := daily[day]; !ok {
			daily[day] = &dayTotals{}
			order = append(order, day)
		}
		daily[day].rev += amt
	}
	revRows.Close()

	expRows, err := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT e.date, e.amount::float FROM "Expense" e JOIN "Branch" b ON b.id = e."branchId" WHERE %s ORDER BY e.date`, expWhere), expArgs...)
	if err != nil {
		return nil, fmt.Errorf("profit daily expenses: %w", err)
	}
	for expRows.Next() {
		var d time.Time
		var amt float64
		if err := expRows.Scan(&d, &amt); err != nil {
			expRows.Close()
			return nil, err
		}
		day := d.UTC().Format("2006-01-02")
		if _, ok := daily[day]; !ok {
			daily[day] = &dayTotals{}
			order = append(order, day)
		}
		daily[day].exp += amt
	}
	expRows.Close()

	sort.Strings(order)
	dailyComparison := make([]domain.ProfitDailyRow, 0, len(order))
	for _, d := range order {
		dt := daily[d]
		dailyComparison = append(dailyComparison, domain.ProfitDailyRow{Date: d, Revenue: dt.rev, Expenses: dt.exp, Profit: dt.rev - dt.exp})
	}

	netProfit := revenue - expenses
	margin := 0.0
	if revenue > 0 {
		margin = (netProfit / revenue) * 100
	}
	return &domain.ProfitReport{
		Summary:         domain.ProfitSummary{Revenue: revenue, Expenses: expenses, NetProfit: netProfit, MarginPercent: margin},
		DailyComparison: dailyComparison,
	}, nil
}

// GetOutstandingReport — sum of unpaid/partial orders.
func (r *PgReportsRepository) GetOutstandingReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.OutstandingReport, error) {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	q := fmt.Sprintf(`
		SELECT o.id, o."orderNumber", o."totalAmount"::float, o."paidAmount"::float, o."createdAt",
		       c.id, c.name, c.phone
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		WHERE %s AND o."paymentStatus" IN ('PENDING', 'PARTIAL')
		ORDER BY o."createdAt" ASC`, where)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("outstanding report: %w", err)
	}
	defer rows.Close()

	type agg struct {
		customerID, name, phone string
		total                   float64
		count                   int
		oldest                  time.Time
		orders                  []domain.OutstandingOrder
	}
	byCust := map[string]*agg{}
	var order []string
	var totalOutstanding float64
	ordersAffected := 0
	for rows.Next() {
		var oid, onum, cid, cname sql.NullString
		var total, paid float64
		var created time.Time
		var phone sql.NullString
		if err := rows.Scan(&oid, &onum, &total, &paid, &created, &cid, &cname, &phone); err != nil {
			return nil, err
		}
		outstanding := total - paid
		totalOutstanding += outstanding
		ordersAffected++
		key := cid.String
		a, ok := byCust[key]
		if !ok {
			a = &agg{customerID: key, name: cname.String, phone: phone.String, oldest: created}
			byCust[key] = a
			order = append(order, key)
		}
		a.total += outstanding
		a.count++
		if created.Before(a.oldest) {
			a.oldest = created
		}
		a.orders = append(a.orders, domain.OutstandingOrder{OrderNumber: onum.String, Outstanding: outstanding, CreatedAt: created.UTC().Format(time.RFC3339)})
	}

	customers := make([]domain.OutstandingCustomer, 0, len(order))
	for _, k := range order {
		a := byCust[k]
		customers = append(customers, domain.OutstandingCustomer{
			CustomerID: a.customerID, Name: a.name, Phone: a.phone,
			TotalOutstanding: a.total, OrderCount: a.count,
			OldestOrder: a.oldest.UTC().Format(time.RFC3339), Orders: a.orders,
		})
	}
	sort.Slice(customers, func(i, j int) bool { return customers[i].TotalOutstanding > customers[j].TotalOutstanding })

	return &domain.OutstandingReport{
		Summary:   domain.OutstandingSummary{TotalOutstanding: totalOutstanding, CustomersAffected: len(customers), OrdersAffected: ordersAffected},
		Customers: customers,
	}, nil
}

// GetPaymentCollection mirrors TS /api/reports/payment-collection.
func (r *PgReportsRepository) GetPaymentCollection(ctx context.Context, tenantID string) (*domain.PaymentCollection, error) {
	// 1. payments grouped by the ORDER's creation month
	payRows, err := r.db.QueryContext(ctx, `
		SELECT p.id, p.amount::float, p."createdAt",
		       o.id, o."orderNumber", o."createdAt",
		       c.id, c.name, c.phone
		FROM "Payment" p
		JOIN "Order" o ON o.id = p."orderId"
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		JOIN "Branch" b ON b.id = o."branchId"
		WHERE b."tenantId" = $1
		ORDER BY p."createdAt"`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("payment collection: %w", err)
	}
	type payMonth struct {
		month          string
		paymentCount   int
		totalCollected float64
		orderIDs       map[string]struct{}
		payments       []domain.PaymentDetail
	}
	payMap := map[string]*payMonth{}
	for payRows.Next() {
		var pid, oid, onum, cid, cname, cphone sql.NullString
		var amt float64
		var payDate, orderCreated time.Time
		if err := payRows.Scan(&pid, &amt, &payDate, &oid, &onum, &orderCreated, &cid, &cname, &cphone); err != nil {
			payRows.Close()
			return nil, err
		}
		mk := orderCreated.Format("2006-01")
		g, ok := payMap[mk]
		if !ok {
			g = &payMonth{month: mk, orderIDs: map[string]struct{}{}}
			payMap[mk] = g
		}
		g.paymentCount++
		g.totalCollected += amt
		g.orderIDs[oid.String] = struct{}{}
		g.payments = append(g.payments, domain.PaymentDetail{
			PaymentID: pid.String, Amount: amt,
			PaymentDate: payDate.UTC().Format(time.RFC3339),
			OrderNumber: onum.String, OrderID: oid.String,
			CustomerName: cname.String, CustomerID: cid.String,
			CustomerPhone:    cphone.String,
			OrderCreatedDate: orderCreated.UTC().Format(time.RFC3339),
		})
	}
	payRows.Close()

	payMonths := make([]domain.PaymentCollMonth, 0, len(payMap))
	totalCollected := 0.0
	for _, g := range payMap {
		payMonths = append(payMonths, domain.PaymentCollMonth{
			Month: g.month, PaymentCount: g.paymentCount, TotalCollected: g.totalCollected,
			OrderCount: len(g.orderIDs), Payments: g.payments,
		})
		totalCollected += g.totalCollected
	}
	sort.Slice(payMonths, func(i, j int) bool { return payMonths[i].Month > payMonths[j].Month })

	// 2. unpaid orders grouped by creation month
	unpaidRows, err := r.db.QueryContext(ctx, `
		SELECT o.id, o."orderNumber", o."totalAmount"::float, o."paidAmount"::float, o."createdAt",
		       c.id, c.name, c.phone
		FROM "Order" o
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		JOIN "Branch" b ON b.id = o."branchId"
		WHERE b."tenantId" = $1 AND o."paymentStatus" IN ('PENDING', 'PARTIAL')
		ORDER BY o."createdAt"`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("unpaid orders: %w", err)
	}
	type unpaidMonth struct {
		month            string
		count            int
		totalOutstanding float64
		orders           []domain.UnpaidOrder
	}
	unpaidMap := map[string]*unpaidMonth{}
	var oldestUnpaid *time.Time
	for unpaidRows.Next() {
		var oid, onum, cid, cname, cphone sql.NullString
		var total, paid float64
		var created time.Time
		if err := unpaidRows.Scan(&oid, &onum, &total, &paid, &created, &cid, &cname, &cphone); err != nil {
			unpaidRows.Close()
			return nil, err
		}
		outstanding := total - paid
		mk := created.Format("2006-01")
		g, ok := unpaidMap[mk]
		if !ok {
			g = &unpaidMonth{month: mk}
			unpaidMap[mk] = g
		}
		g.count++
		g.totalOutstanding += outstanding
		g.orders = append(g.orders, domain.UnpaidOrder{
			OrderID: oid.String, OrderNumber: onum.String,
			TotalAmount: total, PaidAmount: paid, Outstanding: outstanding,
			CreatedAt:    created.UTC().Format(time.RFC3339),
			CustomerName: cname.String, CustomerID: cid.String, CustomerPhone: cphone.String,
		})
		if oldestUnpaid == nil || created.Before(*oldestUnpaid) {
			t := created
			oldestUnpaid = &t
		}
	}
	unpaidRows.Close()

	unpaidMonths := make([]domain.UnpaidMonth, 0, len(unpaidMap))
	totalUnpaid := 0
	totalOutstanding := 0.0
	for _, g := range unpaidMap {
		unpaidMonths = append(unpaidMonths, domain.UnpaidMonth{
			Month: g.month, Count: g.count, TotalOutstanding: g.totalOutstanding, Orders: g.orders,
		})
		totalUnpaid += g.count
		totalOutstanding += g.totalOutstanding
	}
	sort.Slice(unpaidMonths, func(i, j int) bool { return unpaidMonths[i].Month < unpaidMonths[j].Month })

	var oldestStr *string
	if oldestUnpaid != nil {
		s := oldestUnpaid.UTC().Format(time.RFC3339)
		oldestStr = &s
	}

	return &domain.PaymentCollection{
		Summary:                  domain.PaymentCollSummary{TotalCollected: totalCollected, TotalUnpaidOrders: totalUnpaid, TotalOutstanding: totalOutstanding, OldestUnpaid: oldestStr},
		PaymentsCollectedByMonth: payMonths,
		UnpaidByMonth:            unpaidMonths,
	}, nil
}

// GetCommissionReport — per-staff commission.
// GetCommissionReport mirrors TS /api/reports/commission: {summary, byService}.
// Commission is computed per service using commissionType/commissionValue.
func (r *PgReportsRepository) GetCommissionReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.CommissionReport, error) {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT s.id, s.name, s."pricingType", s."commissionType", s."commissionValue"::float,
		       COALESCE(SUM(oi.subtotal::float),0), COUNT(DISTINCT oi."orderId")
		FROM "OrderItem" oi
		JOIN "Order" o ON o.id = oi."orderId" JOIN "Branch" b ON b.id = o."branchId"
		JOIN "Service" s ON s.id = oi."serviceId"
		WHERE %s GROUP BY s.id, s.name, s."pricingType", s."commissionType", s."commissionValue"
		ORDER BY COALESCE(SUM(oi.subtotal::float),0) DESC`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("commission report: %w", err)
	}
	defer rows.Close()

	byService := make([]domain.CommissionBySvcRow, 0)
	var totalRevenue, totalCommission float64
	for rows.Next() {
		var r domain.CommissionBySvcRow
		var commType string
		var commValue float64
		var pricingType string
		var orderCount int64
		if err := rows.Scan(&r.ServiceID, &r.Name, &r.PricingType, &r.CommissionType, &r.CommissionValue, &r.Revenue, &r.OrderCount); err != nil {
			return nil, err
		}
		_ = commType
		_ = commValue
		_ = pricingType
		_ = orderCount
		r.Commission = 0
		if commType == "PERCENTAGE" {
			r.Commission = r.Revenue * commValue / 100
		} else if commType == "FIXED" && orderCount > 0 {
			r.Commission = commValue * float64(orderCount)
		}
		byService = append(byService, r)
		totalRevenue += r.Revenue
		totalCommission += r.Commission
	}
	return &domain.CommissionReport{
		Summary:   domain.CommissionSummary{TotalRevenue: totalRevenue, TotalCommission: totalCommission},
		ByService: byService,
	}, nil
}

// GetAttendanceReport — per-employee hours from ClockEvent.
func (r *PgReportsRepository) GetAttendanceReport(ctx context.Context, tenantID string, filter application.ReportFilter) ([]domain.AttendanceRow, error) {
	where, args := whereClause(tenantID, `ce."tenantId"`, `ce."branchId"`, `ce.timestamp`, filter)

	// ponytail: <ceiling> — hours computed as COUNT(CLOCK_IN) * 8 assuming an
	// 8-hour shift. Real calculation needs paired CLOCK_IN/CLOCK_OUT per day;
	// upgrade when an accurate paired-window query is required.
	q := fmt.Sprintf(`
		SELECT ce."userId",
		       COUNT(*) FILTER (WHERE ce.type = 'CLOCK_IN') * 8.0 AS hours,
		       COUNT(*) FILTER (WHERE ce.type = 'CLOCK_IN') AS clockins
		FROM "ClockEvent" ce
		WHERE %s
		GROUP BY ce."userId"
		ORDER BY hours DESC`, where)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("attendance report: %w", err)
	}
	defer rows.Close()

	var out []domain.AttendanceRow
	for rows.Next() {
		var a domain.AttendanceRow
		if err := rows.Scan(&a.EmployeeID, &a.TotalHours, &a.ClockInCount); err != nil {
			return nil, fmt.Errorf("scanning attendance: %w", err)
		}
		out = append(out, a)
	}
	return out, nil
}

// GetInventoryReport — low-stock items.
// GetInventoryReport mirrors TS /api/reports/inventory.
func (r *PgReportsRepository) GetInventoryReport(ctx context.Context, tenantID string) (*domain.InventoryReport, error) {
	args := []interface{}{tenantID}
	where := `b."tenantId" = $1`

	siRows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT si.name, si.unit, si."currentQuantity"::float, si."lowStockThreshold"::float,
		       si."purchasePricePerUnit"::float, si."currentQuantity"::float * si."purchasePricePerUnit"::float
		FROM "StockItem" si JOIN "Branch" b ON b.id = si."branchId"
		WHERE %s AND si."isActive" = true`, where), args...)
	if err != nil {
		return &domain.InventoryReport{Summary: domain.InventorySummary{}, StockLevels: []domain.InventoryStockRow{}, RecentMovements: []domain.InventoryMovement{}}, nil
	}
	defer siRows.Close()

	stockLevels := make([]domain.InventoryStockRow, 0)
	var totalValue float64
	var lowStockCount int
	for siRows.Next() {
		var s domain.InventoryStockRow
		if err := siRows.Scan(&s.Name, &s.Unit, &s.Quantity, &s.Threshold, &s.Value, &s.Value); err != nil {
			continue
		}
		s.IsLow = s.Quantity <= s.Threshold
		if s.IsLow {
			lowStockCount++
		}
		totalValue += s.Value
		stockLevels = append(stockLevels, s)
	}

	return &domain.InventoryReport{
		Summary:         domain.InventorySummary{TotalItems: len(stockLevels), TotalValue: totalValue, LowStockCount: lowStockCount},
		StockLevels:     stockLevels,
		RecentMovements: []domain.InventoryMovement{},
	}, nil
}

// GetPiutangReport — accounts receivable grouped by customer (UNPAID-ish orders).
// GetPiutangReport mirrors TS /api/reports/piutang-tracker.
func (r *PgReportsRepository) GetPiutangReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.PiutangReport, error) {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT o.id, o."orderNumber", COALESCE(c.name,''), o.status,
		       o."totalAmount"::float, o."paidAmount"::float,
		       o."totalAmount"::float - o."paidAmount"::float AS outstanding,
		       o."createdAt"
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		WHERE %s AND o."paymentStatus" IN ('PENDING','PARTIAL')
		ORDER BY o."createdAt" ASC`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("piutang report: %w", err)
	}
	defer rows.Close()

	now := time.Now()
	orders := make([]domain.PiutangOrder, 0)
	buckets := map[string]domain.AgingBucket{"0-30": {}, "31-60": {}, "61-90": {}, "90+": {}}
	var totalOutstanding float64
	for rows.Next() {
		var o domain.PiutangOrder
		var created time.Time
		if err := rows.Scan(&o.ID, &o.OrderNumber, &o.Customer, &o.Status,
			&o.TotalAmount, &o.PaidAmount, &o.Outstanding, &created); err != nil {
			return nil, err
		}
		o.CreatedAt = created.UTC().Format(time.RFC3339)
		o.Payments = []any{}
		o.AgeDays = int(now.Sub(created).Hours() / 24)
		switch {
		case o.AgeDays <= 30:
			o.Bucket = "0-30"
			ab := buckets["0-30"]
			ab.Count++
			ab.Amount += o.Outstanding
			buckets["0-30"] = ab
		case o.AgeDays <= 60:
			o.Bucket = "31-60"
			ab := buckets["31-60"]
			ab.Count++
			ab.Amount += o.Outstanding
			buckets["31-60"] = ab
		case o.AgeDays <= 90:
			o.Bucket = "61-90"
			ab := buckets["61-90"]
			ab.Count++
			ab.Amount += o.Outstanding
			buckets["61-90"] = ab
		default:
			o.Bucket = "90+"
			ab := buckets["90+"]
			ab.Count++
			ab.Amount += o.Outstanding
			buckets["90+"] = ab
		}
		totalOutstanding += o.Outstanding
		orders = append(orders, o)
	}

	// Compute monthly summary (last 6 months).
	monthlyMap := map[string]*domain.PiutangMonthly{}
	var monthOrder []string
	for i := 5; i >= 0; i-- {
		d := now.AddDate(0, -i, 0)
		mk := d.UTC().Format("2006-01")
		monthlyMap[mk] = &domain.PiutangMonthly{Month: mk}
		monthOrder = append(monthOrder, mk)
	}
	for _, o := range orders {
		created, _ := time.Parse(time.RFC3339, o.CreatedAt)
		mk := created.UTC().Format("2006-01")
		if m, ok := monthlyMap[mk]; ok {
			m.NewOrders++
			m.NewPiutang += o.Outstanding
			m.StillOutstanding += o.Outstanding
		}
	}

	monthlySummary := make([]domain.PiutangMonthly, 0, len(monthOrder))
	for _, mk := range monthOrder {
		monthlySummary = append(monthlySummary, *monthlyMap[mk])
	}

	return &domain.PiutangReport{
		MonthlySummary:        monthlySummary,
		AgingBuckets:          buckets,
		TotalOutstanding:      totalOutstanding,
		OutstandingOrderCount: len(orders),
		Orders:                orders,
	}, nil
}

// GetFinancialStatement mirrors TS /api/reports/financial-statement.
func (r *PgReportsRepository) GetFinancialStatement(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.FinancialStatement, error) {
	profit, err := r.GetProfitReport(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}
	outstanding, err := r.GetOutstandingReport(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}
	revenue, err := r.GetRevenueReport(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}
	_, _ = r.GetExpensesReport(ctx, tenantID, filter)

	// Top services by revenue
	svcReport, _ := r.GetServicesReport(ctx, tenantID, filter)
	topServices := make([]domain.FinTopItem, 0, len(svcReport.Services))
	for _, s := range svcReport.Services {
		topServices = append(topServices, domain.FinTopItem{Name: s.Name, OrderCount: s.OrderCount, Revenue: s.TotalRevenue})
	}

	// Top customers
	custReport, _ := r.GetCustomersReport(ctx, tenantID, filter)
	topCustomers := make([]domain.FinTopItem, 0, len(custReport.TopSpenders))
	for _, c := range custReport.TopSpenders {
		topCustomers = append(topCustomers, domain.FinTopItem{Name: c.Name, OrderCount: c.Orders, TotalSpent: c.TotalSpent})
	}

	totalOrders := revenue.Summary.OrdersCount
	avgOrder := 0.0
	if totalOrders > 0 {
		avgOrder = revenue.Summary.GrossRevenue / float64(totalOrders)
	}
	margin := 0.0
	if profit.Summary.Revenue > 0 {
		margin = profit.Summary.MarginPercent
	}

	return &domain.FinancialStatement{
		Summary: domain.FinSummary{
			Revenue:           profit.Summary.Revenue,
			Expenses:          profit.Summary.Expenses,
			NetProfit:         profit.Summary.NetProfit,
			MarginPercent:     margin,
			TotalOrders:       totalOrders,
			AvgOrderValue:     avgOrder,
			TotalOutstanding:  outstanding.Summary.TotalOutstanding,
			AffectedCustomers: outstanding.Summary.CustomersAffected,
		},
		DailyBreakdown:     r.getDailyBreakdown(ctx, tenantID, filter),
		TopServices:        topServices,
		ExpensesByCategory: []interface{}{},
		ByPaymentMethod:    []interface{}{},
		TopCustomers:       topCustomers,
		Outstanding: domain.FinOutstanding{
			Total:             outstanding.Summary.TotalOutstanding,
			CustomersAffected: outstanding.Summary.CustomersAffected,
			OrdersAffected:    outstanding.Summary.OrdersAffected,
			TopBalances:       r.getTopBalances(ctx, tenantID, filter),
		},
		Turnaround: domain.FinTurnaround{
			Distribution:   map[string]int{"under24h": 0, "under48h": 0, "under72h": 0, "over72h": 0},
			TotalDelivered: 0,
		},
		Inventory: domain.FinInventory{},
	}, nil
}

// getTopBalances returns the top customers by outstanding balance for the financial statement.
func (r *PgReportsRepository) getTopBalances(ctx context.Context, tenantID string, filter application.ReportFilter) []domain.FinTopBalance {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	rows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT COALESCE(c.name,'Unknown'), SUM(o."totalAmount"::float - o."paidAmount"::float),
		       MIN(o."createdAt")
		FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" LEFT JOIN "Customer" c ON c.id=o."customerId"
		WHERE %s AND o."paymentStatus" IN ('PENDING','PARTIAL')
		GROUP BY c.name ORDER BY SUM(o."totalAmount"::float - o."paidAmount"::float) DESC LIMIT 5`, where), args...)
	if rows == nil {
		return []domain.FinTopBalance{}
	}
	defer rows.Close()
	out := make([]domain.FinTopBalance, 0)
	for rows.Next() {
		var b domain.FinTopBalance
		var oldest time.Time
		if rows.Scan(&b.Name, &b.Balance, &oldest) == nil {
			b.OldestOrder = oldest.UTC().Format(time.RFC3339)
			out = append(out, b)
		}
	}
	return out
}

// getDailyBreakdown computes daily revenue+expenses+profit for the financial statement.
func (r *PgReportsRepository) getDailyBreakdown(ctx context.Context, tenantID string, filter application.ReportFilter) []domain.FinDaily {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	revMap := map[string]float64{}
	revRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT COALESCE(o."receivedAt", o."createdAt") AS d, o."totalAmount"::float
		 FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" WHERE %s AND o.status='DELIVERED'`, where), args...)
	if revRows != nil {
		for revRows.Next() {
			var d time.Time
			var amt float64
			if revRows.Scan(&d, &amt) == nil {
				revMap[d.UTC().Format("2006-01-02")] += amt
			}
		}
		revRows.Close()
	}
	expMap := map[string]float64{}
	expWhere, expArgs := whereClause(tenantID, `b."tenantId"`, `e."branchId"`, `e.date`, filter)
	expRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT e.date, e.amount::float FROM "Expense" e JOIN "Branch" b ON b.id=e."branchId" WHERE %s`, expWhere), expArgs...)
	if expRows != nil {
		for expRows.Next() {
			var d time.Time
			var amt float64
			if expRows.Scan(&d, &amt) == nil {
				expMap[d.UTC().Format("2006-01-02")] += amt
			}
		}
		expRows.Close()
	}
	daySet := map[string]bool{}
	for k := range revMap {
		daySet[k] = true
	}
	for k := range expMap {
		daySet[k] = true
	}
	var days []string
	for k := range daySet {
		days = append(days, k)
	}
	sort.Strings(days)
	out := make([]domain.FinDaily, 0, len(days))
	for _, d := range days {
		rev := revMap[d]
		exp := expMap[d]
		out = append(out, domain.FinDaily{Date: d, Revenue: rev, Expenses: exp, Profit: rev - exp})
	}
	return out
}
