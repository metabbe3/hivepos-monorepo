package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/hivepos/api/internal/modules/dashboard/application"
	"github.com/hivepos/api/internal/modules/dashboard/domain"
)

type PgDashboardRepository struct {
	db *sql.DB
}

func NewPgDashboardRepository(db *sql.DB) *PgDashboardRepository {
	return &PgDashboardRepository{db: db}
}

// GetStats mirrors TS /api/dashboard/stats — the most complex endpoint (17 queries,
// comparison metrics, sparkline, turnaround, customer insights, etc.).
func (r *PgDashboardRepository) GetStats(ctx context.Context, tenantID string, f application.StatsFilter) (*domain.Stats, error) {
	now := time.Now()
	// Honor the caller's from/to (YYYY-MM-DD); default to today when missing/unparseable.
	from := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	to := from.Add(24*time.Hour - time.Second)
	if parsed, err := time.Parse("2006-01-02", f.From); err == nil {
		from = parsed
	}
	if parsed, err := time.Parse("2006-01-02", f.To); err == nil {
		to = parsed.Add(24*time.Hour - time.Second) // include the full end day
	}
	mod := f.Module
	if mod == "" {
		mod = "LAUNDRY"
	}
	bID := f.BranchID
	branchIn := `o."branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $1)`
	baseArgs := []interface{}{tenantID, from, to, mod}
	if bID != "" && bID != "ALL" {
		branchIn += fmt.Sprintf(` AND o."branchId" = $%d`, len(baseArgs)+1)
		baseArgs = append(baseArgs, bID)
	}
	periodFilter := fmt.Sprintf(`%s AND o.module = $4 AND COALESCE(o."receivedAt",o."createdAt") >= $2 AND COALESCE(o."receivedAt",o."createdAt") <= $3`, branchIn)

	// Previous period (same length, ending yesterday)
	periodDur := to.Sub(from)
	prevToT := from.Add(-time.Second)
	prevFromT := prevToT.Add(-periodDur)
	prevArgs := []interface{}{tenantID, prevFromT, prevToT, mod}
	prevBranchIn := `o."branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $1)`
	if bID != "" && bID != "ALL" {
		prevBranchIn += fmt.Sprintf(` AND o."branchId" = $%d`, len(prevArgs)+1)
		prevArgs = append(prevArgs, bID)
	}
	prevFilter := fmt.Sprintf(`%s AND o.module = $4 AND COALESCE(o."receivedAt",o."createdAt") >= $2 AND COALESCE(o."receivedAt",o."createdAt") <= $3`, prevBranchIn)

	s := &domain.Stats{
		OrderPipeline:          map[string]int64{},
		TopCustomers:           []domain.DashboardTopCustomer{},
		ServiceBreakdown:       []domain.DashboardService{},
		PaymentMethodBreakdown: []domain.DashboardPayment{},
		RecentOrders:           []domain.DashboardRecentOrder{},
		LowStock:               []domain.LowStockItem{},
		UnpaidOrders:           []domain.UnpaidOrderDash{},
		Sparkline:              make([]int64, 7),
	}

	// 1. Period orders grouped by status
	rows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o.status, COUNT(*), COALESCE(SUM(o."totalAmount"::float),0) FROM "Order" o WHERE %s GROUP BY o.status`, periodFilter), baseArgs...)
	var pipelineReceived, pipelineInProgress, pipelineReady, pipelineDelivered int64
	for rows != nil && rows.Next() {
		var st string
		var cnt int64
		var sum float64
		if rows.Scan(&st, &cnt, &sum) == nil {
			s.TodayOrders += cnt
			s.TodayOmset += sum
			s.OrderPipeline[st] = cnt
			switch st {
			case "RECEIVED":
				pipelineReceived = cnt
			case "IN_PROGRESS":
				pipelineInProgress = cnt
			case "READY":
				pipelineReady = cnt
			case "DELIVERED":
				pipelineDelivered = cnt
			}
		}
	}
	if rows != nil {
		rows.Close()
	}
	_ = pipelineReceived
	_ = pipelineInProgress
	_ = pipelineReady
	_ = pipelineDelivered
	s.OrderPipeline = map[string]int64{"RECEIVED": pipelineReceived, "IN_PROGRESS": pipelineInProgress, "READY": pipelineReady, "DELIVERED": pipelineDelivered}

	// 2. Previous period for comparison
	prevRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o.status, COUNT(*), COALESCE(SUM(o."totalAmount"::float),0) FROM "Order" o WHERE %s GROUP BY o.status`, prevFilter), prevArgs...)
	var prevOrderCount int64
	var prevOmset float64
	for prevRows != nil && prevRows.Next() {
		var st string
		var cnt int64
		var sum float64
		if prevRows.Scan(&st, &cnt, &sum) == nil {
			prevOrderCount += cnt
			prevOmset += sum
		}
	}
	if prevRows != nil {
		prevRows.Close()
	}

	// 3. All-time status counts (inProgress, readyForPickup)
	allTimeArgs := []interface{}{tenantID, mod}
	allTimeBranchIn := `o."branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $1)`
	if bID != "" && bID != "ALL" {
		allTimeBranchIn += fmt.Sprintf(` AND o."branchId" = $%d`, len(allTimeArgs)+1)
		allTimeArgs = append(allTimeArgs, bID)
	}
	allTimeRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o.status, COUNT(*) FROM "Order" o WHERE %s AND o.module = $2 GROUP BY o.status`, allTimeBranchIn), allTimeArgs...)
	for allTimeRows != nil && allTimeRows.Next() {
		var st string
		var cnt int64
		if allTimeRows.Scan(&st, &cnt) == nil {
			if st == "IN_PROGRESS" {
				s.InProgress = cnt
			}
			if st == "READY" {
				s.ReadyForPickup = cnt
			}
		}
	}
	if allTimeRows != nil {
		allTimeRows.Close()
	}

	// 4. Revenue (payments in period) + previous revenue
	payArgs := []interface{}{tenantID, from, to}
	payWhere := `b."tenantId" = $1 AND pay."paidAt" >= $2 AND pay."paidAt" <= $3`
	if bID != "" && bID != "ALL" {
		payWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(payArgs)+1)
		payArgs = append(payArgs, bID)
	}
	payWhere += fmt.Sprintf(` AND o.module = $%d`, len(payArgs)+1)
	payArgs = append(payArgs, mod)
	var currentRevenue float64
	r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COALESCE(SUM(pay.amount::float),0) FROM "Payment" pay JOIN "Order" o ON o.id=pay."orderId" JOIN "Branch" b ON b.id=o."branchId" WHERE %s`, payWhere), payArgs...).Scan(&currentRevenue)
	s.TodayRevenue = currentRevenue

	prevPayArgs := []interface{}{tenantID, prevFromT, prevToT}
	prevPayWhere := `b."tenantId" = $1 AND pay."paidAt" >= $2 AND pay."paidAt" <= $3`
	if bID != "" && bID != "ALL" {
		prevPayWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(prevPayArgs)+1)
		prevPayArgs = append(prevPayArgs, bID)
	}
	prevPayWhere += fmt.Sprintf(` AND o.module = $%d`, len(prevPayArgs)+1)
	prevPayArgs = append(prevPayArgs, mod)
	var previousRevenue float64
	r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COALESCE(SUM(pay.amount::float),0) FROM "Payment" pay JOIN "Order" o ON o.id=pay."orderId" JOIN "Branch" b ON b.id=o."branchId" WHERE %s`, prevPayWhere), prevPayArgs...).Scan(&previousRevenue)
	s.PreviousRevenue = previousRevenue

	s.RevenueChange = calcChange(currentRevenue, previousRevenue)
	s.OmsetChange = calcChange(s.TodayOmset, prevOmset)

	// 5. Recent orders (10)
	recentArgs := []interface{}{tenantID, mod}
	recentWhere := `b."tenantId" = $1 AND o.module = $2`
	if bID != "" && bID != "ALL" {
		recentWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(recentArgs)+1)
		recentArgs = append(recentArgs, bID)
	}
	recentRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o.id, o."orderNumber", COALESCE(c.name,'Unknown'), o.status, o."totalAmount"::float, o."createdAt"
		 FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" LEFT JOIN "Customer" c ON c.id=o."customerId"
		 WHERE %s ORDER BY o."createdAt" DESC LIMIT 10`, recentWhere), recentArgs...)
	for recentRows != nil && recentRows.Next() {
		var ro domain.DashboardRecentOrder
		if recentRows.Scan(&ro.ID, &ro.OrderNumber, &ro.CustomerName, &ro.Status, &ro.TotalAmount, &ro.CreatedAt) == nil {
			ro.CreatedAt = parseISO(ro.CreatedAt)
			s.RecentOrders = append(s.RecentOrders, ro)
		}
	}
	if recentRows != nil {
		recentRows.Close()
	}

	// 6. Top customers (5)
	tcArgs := append([]interface{}{}, baseArgs...)
	tcRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."customerId", COUNT(*), COALESCE(SUM(o."totalAmount"::float),0)
		 FROM "Order" o WHERE %s GROUP BY o."customerId" ORDER BY SUM(o."totalAmount"::float) DESC LIMIT 5`, periodFilter), tcArgs...)
	type tcAgg struct {
		id    string
		cnt   int64
		spent float64
	}
	var tcAggs []tcAgg
	for tcRows != nil && tcRows.Next() {
		var a tcAgg
		var cid sql.NullString
		if tcRows.Scan(&cid, &a.cnt, &a.spent) == nil {
			a.id = cid.String
			tcAggs = append(tcAggs, a)
		}
	}
	if tcRows != nil {
		tcRows.Close()
	}
	// resolve names
	tcNames := map[string]string{}
	if len(tcAggs) > 0 {
		ids := make([]interface{}, 0)
		in := ""
		for _, a := range tcAggs {
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
			nr, _ := r.db.QueryContext(ctx, fmt.Sprintf(`SELECT id,name FROM "Customer" WHERE id IN (%s)`, in), ids...)
			if nr != nil {
				for nr.Next() {
					var id, nm string
					if nr.Scan(&id, &nm) == nil {
						tcNames[id] = nm
					}
				}
				nr.Close()
			}
		}
	}
	for _, a := range tcAggs {
		nm := "Unknown"
		if n, ok := tcNames[a.id]; ok {
			nm = n
		}
		s.TopCustomers = append(s.TopCustomers, domain.DashboardTopCustomer{CustomerID: a.id, Name: nm, Orders: a.cnt, TotalSpent: a.spent})
	}

	// 7. Expenses + wallet deposits
	expArgs := []interface{}{tenantID, from, to}
	expWhere := `b."tenantId" = $1 AND e.date >= $2 AND e.date <= $3`
	if bID != "" && bID != "ALL" {
		expWhere += fmt.Sprintf(` AND e."branchId" = $%d`, len(expArgs)+1)
		expArgs = append(expArgs, bID)
	}
	var todayExpenses float64
	r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COALESCE(SUM(e.amount::float),0) FROM "Expense" e JOIN "Branch" b ON b.id=e."branchId" WHERE %s`, expWhere), expArgs...).Scan(&todayExpenses)

	var prevExpenses float64
	prevExpArgs := []interface{}{tenantID, prevFromT, prevToT}
	prevExpWhere := `b."tenantId" = $1 AND e.date >= $2 AND e.date <= $3`
	if bID != "" && bID != "ALL" {
		prevExpWhere += fmt.Sprintf(` AND e."branchId" = $%d`, len(prevExpArgs)+1)
		prevExpArgs = append(prevExpArgs, bID)
	}
	r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COALESCE(SUM(e.amount::float),0) FROM "Expense" e JOIN "Branch" b ON b.id=e."branchId" WHERE %s`, prevExpWhere), prevExpArgs...).Scan(&prevExpenses)

	var walletDeposits float64
	walletWhere := `b."tenantId"=$1 AND dt.type='TOP_UP' AND dt."createdAt" >= $2 AND dt."createdAt" <= $3`
	if bID != "" && bID != "ALL" {
		// bID is already the 4th element of expArgs (appended by the expenses block above).
		walletWhere += ` AND dt."branchId" = $4`
	}
	r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COALESCE(SUM(dt.amount::float),0) FROM "DepositTransaction" dt JOIN "Branch" b ON b.id=dt."branchId" WHERE %s`, walletWhere), expArgs...).Scan(&walletDeposits)

	s.CashFlow = domain.CashFlow{Income: currentRevenue, Expenses: todayExpenses, Net: currentRevenue - todayExpenses, WalletDeposits: walletDeposits}

	// Payment-method breakdown (method→total) for the dashboard PaymentMethodsCard.
	pbArgs := []interface{}{tenantID, mod, from, to}
	pbWhere := `b."tenantId" = $1 AND o.module = $2 AND p."paidAt" >= $3 AND p."paidAt" <= $4`
	if bID != "" && bID != "ALL" {
		pbWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(pbArgs)+1)
		pbArgs = append(pbArgs, bID)
	}
	pbRows, pbErr := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT "paymentMethod", SUM(amount::float) FROM "Payment" p
		 JOIN "Order" o ON o.id = p."orderId" JOIN "Branch" b ON b.id = o."branchId"
		 WHERE %s GROUP BY "paymentMethod"`, pbWhere), pbArgs...)
	if pbErr == nil {
		s.PaymentBreakdown = map[string]float64{}
		for pbRows.Next() {
			var method string
			var total float64
			if err := pbRows.Scan(&method, &total); err != nil {
				pbRows.Close()
				return nil, fmt.Errorf("scanning payment breakdown: %w", err)
			}
			s.PaymentBreakdown[method] = total
		}
		pbRows.Close()
	}

	// Service breakdown: top services by revenue in the period (ServiceCompositionCard).
	sbRows, sbErr := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT svc.id, svc.name, COUNT(oi.id) AS orders, COALESCE(SUM(oi.subtotal::float), 0) AS revenue
		FROM "OrderItem" oi
		JOIN "Order" o ON o.id = oi."orderId"
		JOIN "Branch" b ON b.id = o."branchId"
		JOIN "Service" svc ON svc.id = oi."serviceId"
		WHERE %s
		GROUP BY svc.id, svc.name
		ORDER BY revenue DESC
		LIMIT 10`, periodFilter), baseArgs...)
	if sbErr == nil {
		for sbRows.Next() {
			var sb domain.DashboardService
			if err := sbRows.Scan(&sb.ServiceID, &sb.Name, &sb.Orders, &sb.Revenue); err != nil {
				sbRows.Close()
				return nil, fmt.Errorf("scanning service breakdown: %w", err)
			}
			s.ServiceBreakdown = append(s.ServiceBreakdown, sb)
		}
		sbRows.Close()
	}

	// 8. Comparison metrics
	s.Comparison = domain.DashboardComparison{
		Revenue:     domain.ComparisonMetric{Current: currentRevenue, Previous: previousRevenue, ChangePercent: calcChange(currentRevenue, previousRevenue)},
		Orders:      domain.ComparisonMetric{Current: float64(s.TodayOrders), Previous: float64(prevOrderCount), ChangePercent: calcChange(float64(s.TodayOrders), float64(prevOrderCount))},
		Expenses:    domain.ComparisonMetric{Current: todayExpenses, Previous: prevExpenses, ChangePercent: calcChange(todayExpenses, prevExpenses)},
		NetCashFlow: domain.ComparisonMetric{Current: currentRevenue - todayExpenses, Previous: previousRevenue - prevExpenses, ChangePercent: calcChange(currentRevenue-todayExpenses, previousRevenue-prevExpenses)},
	}

	// 9. Low stock items
	lsArgs := []interface{}{tenantID}
	lsWhere := `b."tenantId" = $1 AND si."isActive" = true`
	if bID != "" && bID != "ALL" {
		lsWhere += fmt.Sprintf(` AND si."branchId" = $%d`, len(lsArgs)+1)
		lsArgs = append(lsArgs, bID)
	}
	lsRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT si.id, si.name, si.unit, si."currentQuantity"::float, si."lowStockThreshold"::float
		 FROM "StockItem" si JOIN "Branch" b ON b.id=si."branchId" WHERE %s`, lsWhere), lsArgs...)
	for lsRows != nil && lsRows.Next() {
		var ls domain.LowStockItem
		if lsRows.Scan(&ls.ID, &ls.Name, &ls.Unit, &ls.CurrentQuantity, &ls.LowStockThreshold) == nil {
			if ls.CurrentQuantity <= ls.LowStockThreshold {
				s.LowStock = append(s.LowStock, ls)
			}
		}
	}
	if lsRows != nil {
		lsRows.Close()
	}

	// 10. Customer insights
	custArgs := []interface{}{tenantID}
	custWhere := `b."tenantId" = $1`
	if bID != "" && bID != "ALL" {
		custWhere += fmt.Sprintf(` AND c."branchId" = $%d`, len(custArgs)+1)
		custArgs = append(custArgs, bID)
	}
	weekStart := now.AddDate(0, 0, -int(now.Weekday()))
	weekStart = time.Date(weekStart.Year(), weekStart.Month(), weekStart.Day(), 0, 0, 0, 0, now.Location())
	thirtyDays := 30 * 24 * time.Hour
	ninetyDays := 90 * 24 * time.Hour
	custRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT c."createdAt", (SELECT MAX(o."createdAt") FROM "Order" o WHERE o."customerId"=c.id)
		 FROM "Customer" c JOIN "Branch" b ON b.id=c."branchId" WHERE %s`, custWhere), custArgs...)
	var totalCust, newWeek, active, atRisk, lapsed int64
	for custRows != nil && custRows.Next() {
		var created time.Time
		var lastOrder sql.NullTime
		if custRows.Scan(&created, &lastOrder) != nil {
			continue
		}
		totalCust++
		if created.After(weekStart) {
			newWeek++
		}
		if !lastOrder.Valid {
			if now.Sub(created) >= thirtyDays {
				lapsed++
			}
		} else {
			since := now.Sub(lastOrder.Time)
			if since <= thirtyDays {
				active++
			} else if since <= ninetyDays {
				atRisk++
			} else {
				lapsed++
			}
		}
	}
	if custRows != nil {
		custRows.Close()
	}
	s.CustomerInsights = domain.CustomerInsights{Total: totalCust, NewThisWeek: newWeek, Active: active, AtRisk: atRisk, Lapsed: lapsed}

	// 11. Unpaid delivered + unpaid orders
	unpaidDelArgs := []interface{}{tenantID, mod}
	unpaidDelWhere := `b."tenantId" = $1 AND o.module = $2 AND o.status='DELIVERED' AND o."paymentStatus" IN ('PENDING','PARTIAL')`
	if bID != "" && bID != "ALL" {
		unpaidDelWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(unpaidDelArgs)+1)
		unpaidDelArgs = append(unpaidDelArgs, bID)
	}
	r.db.QueryRowContext(ctx, fmt.Sprintf(`SELECT COUNT(*) FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" WHERE %s`, unpaidDelWhere), unpaidDelArgs...).Scan(&s.UnpaidDelivered)

	unpaidArgs := []interface{}{tenantID, mod}
	unpaidWhere := `b."tenantId" = $1 AND o.module = $2 AND o."paymentStatus" IN ('PENDING','PARTIAL')`
	if bID != "" && bID != "ALL" {
		unpaidWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(unpaidArgs)+1)
		unpaidArgs = append(unpaidArgs, bID)
	}
	unpaidRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o.id, o."orderNumber", COALESCE(c.name,''), COALESCE(c.phone,''), o."totalAmount"::float, o.status, o."paymentStatus", o."createdAt"
		 FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" LEFT JOIN "Customer" c ON c.id=o."customerId"
		 WHERE %s ORDER BY o."createdAt" ASC LIMIT 20`, unpaidWhere), unpaidArgs...)
	for unpaidRows != nil && unpaidRows.Next() {
		var uo domain.UnpaidOrderDash
		if unpaidRows.Scan(&uo.ID, &uo.OrderNumber, &uo.CustomerName, &uo.CustomerPhone, &uo.TotalAmount, &uo.Status, &uo.PaymentStatus, &uo.CreatedAt) == nil {
			uo.CreatedAt = parseISO(uo.CreatedAt)
			s.UnpaidOrders = append(s.UnpaidOrders, uo)
		}
	}
	if unpaidRows != nil {
		unpaidRows.Close()
	}

	// 12. Turnaround (delivered orders)
	turnArgs := []interface{}{tenantID, mod}
	turnWhere := `b."tenantId" = $1 AND o.module = $2 AND o.status='DELIVERED' AND o."deliveredAt" IS NOT NULL AND o."receivedAt" IS NOT NULL`
	if bID != "" && bID != "ALL" {
		turnWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(turnArgs)+1)
		turnArgs = append(turnArgs, bID)
	}
	turnRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(
		`SELECT o."receivedAt", o."deliveredAt" FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" WHERE %s ORDER BY o."deliveredAt" DESC LIMIT 50`, turnWhere), turnArgs...)
	var hours []float64
	for turnRows != nil && turnRows.Next() {
		var rec, del time.Time
		if turnRows.Scan(&rec, &del) == nil {
			h := del.Sub(rec).Hours()
			if h >= 0 {
				hours = append(hours, h)
			}
		}
	}
	if turnRows != nil {
		turnRows.Close()
	}
	if len(hours) > 0 {
		var sum, mn, mx float64
		mn = hours[0]
		mx = hours[0]
		for _, h := range hours {
			sum += h
			if h < mn {
				mn = h
			}
			if h > mx {
				mx = h
			}
		}
		avg := sum / float64(len(hours))
		s.Turnaround = domain.Turnaround{AvgHours: &avg, FastestHours: &mn, SlowestHours: &mx, CompletedCount: len(hours)}
	} else {
		s.Turnaround = domain.Turnaround{CompletedCount: 0}
	}

	// 13. Sparkline — single generate_series query (was 7 separate COUNT queries).
	spWhere := `b."tenantId" = $1 AND o.module = $2`
	spArgs := []interface{}{tenantID, mod}
	if bID != "" && bID != "ALL" {
		spWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(spArgs)+1)
		spArgs = append(spArgs, bID)
	}
	spRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT COUNT(o.id) AS cnt
		FROM generate_series(0, 6) AS g(n)
		LEFT JOIN (
			SELECT o.id, COALESCE(o."receivedAt", o."createdAt") AS dt
			FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
			WHERE %s
		) o ON date_trunc('day', o.dt) = date_trunc('day', NOW() - (n || ' days')::interval)
		GROUP BY n ORDER BY n DESC`, spWhere), spArgs...)
	if spRows != nil {
		idx := 0
		for spRows.Next() && idx < len(s.Sparkline) {
			spRows.Scan(&s.Sparkline[idx])
			idx++
		}
		spRows.Close()
	}

	// 14. Service breakdown populated above (section after payment breakdown).

	return s, nil
}

func calcChange(current, previous float64) *float64 {
	if previous == 0 {
		return nil
	}
	v := ((current - previous) / previous) * 100
	return &v
}

func parseISO(s string) string {
	t, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t, err = time.Parse("2006-01-02T15:04:05.999Z", s)
		if err != nil {
			return s
		}
	}
	return t.UTC().Format(time.RFC3339)
}

// GetKanban returns the live order pipeline grouped by status (date-unbound).
// GetKanban mirrors TS /api/dashboard/kanban: flat order-detail arrays (not status aggregates).
func (r *PgDashboardRepository) GetKanban(ctx context.Context, tenantID, branchID, module string) ([]map[string]interface{}, error) {
	args := []interface{}{tenantID}
	idx := 2
	where := `WHERE b."tenantId" = $1`
	if branchID != "" && branchID != "ALL" {
		where += fmt.Sprintf(` AND o."branchId" = $%d`, idx)
		args = append(args, branchID)
		idx++
	}
	if module != "" {
		where += fmt.Sprintf(` AND o.module = $%d`, idx)
		args = append(args, module)
		idx++
	}
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT o.id, o."orderNumber", COALESCE(c.name,''), COALESCE(c.phone,''),
		       o.status, o."totalAmount"::float, o."paidAmount"::float, o."paymentStatus",
		       o."createdAt", o."receivedAt", o."inProgressAt", o."readyAt", o."deliveredAt",
		       EXISTS(SELECT 1 FROM "OrderItem" oi JOIN "Service" s ON s.id = oi."serviceId"
		              WHERE oi."orderId" = o.id AND s.name ILIKE '%%express%%') AS "isExpress"
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		%s ORDER BY o."createdAt" DESC LIMIT 100`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("querying kanban: %w", err)
	}
	defer rows.Close()
	var list []map[string]interface{}
	var orderIDs []string
	for rows.Next() {
		var id, orderNum, custName, custPhone, status, payStatus string
		var total, paid float64
		var created time.Time
		var received, inProg, ready, delivered sql.NullTime
		var isExpress bool
		if err := rows.Scan(&id, &orderNum, &custName, &custPhone, &status, &total, &paid,
			&payStatus, &created, &received, &inProg, &ready, &delivered, &isExpress); err != nil {
			return nil, fmt.Errorf("scanning kanban: %w", err)
		}
		orderIDs = append(orderIDs, id)
		items := []map[string]interface{}{}

		row := map[string]interface{}{
			"id":            id,
			"orderNumber":   orderNum,
			"customerName":  custName,
			"customerPhone": custPhone,
			"status":        status,
			"totalAmount":   total,
			"paidAmount":    paid,
			"paymentStatus": payStatus,
			"createdAt":     created.UTC().Format(time.RFC3339),
			"receivedAt":    nil,
			"inProgressAt":  nil,
			"readyAt":       nil,
			"deliveredAt":   nil,
			"isExpress":     isExpress,
			"items":         items,
		}
		if received.Valid {
			row["receivedAt"] = received.Time.UTC().Format(time.RFC3339)
		}
		if inProg.Valid {
			row["inProgressAt"] = inProg.Time.UTC().Format(time.RFC3339)
		}
		if ready.Valid {
			row["readyAt"] = ready.Time.UTC().Format(time.RFC3339)
		}
		if delivered.Valid {
			row["deliveredAt"] = delivered.Time.UTC().Format(time.RFC3339)
		}
		list = append(list, row)
	}
	// Batch-fetch all items for the collected orders (one query instead of N per-order queries).
	if len(orderIDs) > 0 {
		ph := make([]string, len(orderIDs))
		iargs := make([]interface{}, len(orderIDs))
		for i, id := range orderIDs {
			ph[i] = fmt.Sprintf("$%d", i+1)
			iargs[i] = id
		}
		itemRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
			SELECT oi."orderId", COALESCE(s.name,''), COALESCE(oi.quantity::float,0), COALESCE(oi."weightKg"::float,0)
			FROM "OrderItem" oi LEFT JOIN "Service" s ON s.id = oi."serviceId"
			WHERE oi."orderId" IN (%s)`, strings.Join(ph, ",")), iargs...)
		if itemRows != nil {
			itemsByOrder := map[string][]map[string]interface{}{}
			for itemRows.Next() {
				var oid, svcName string
				var qty, weight float64
				if itemRows.Scan(&oid, &svcName, &qty, &weight) == nil {
					itemsByOrder[oid] = append(itemsByOrder[oid], map[string]interface{}{
						"serviceName": svcName, "quantity": qty, "weightKg": weight,
					})
				}
			}
			itemRows.Close()
			for _, row := range list {
				if id, ok := row["id"].(string); ok {
					if items, found := itemsByOrder[id]; found {
						row["items"] = items
					}
				}
			}
		}
	}
	return list, nil
}

// GetHeatmap mirrors TS /api/dashboard/heatmap: {customerVisits, hourlyByDay, revenueByDay, revenueTrend}.
func (r *PgDashboardRepository) GetHeatmap(ctx context.Context, tenantID, branchID string) (map[string]interface{}, error) {
	args := []interface{}{tenantID}
	where := `WHERE b."tenantId" = $1`
	if branchID != "" && branchID != "ALL" {
		where += fmt.Sprintf(` AND o."branchId" = $%d`, len(args)+1)
		args = append(args, branchID)
	}
	// customerVisits: top customers with per-day-of-week visit distribution
	cvRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT COALESCE(c.id,''), COALESCE(c.name,'Unknown'), COUNT(DISTINCT o.id) AS visits
		FROM "Order" o JOIN "Branch" b ON b.id=o."branchId"
		LEFT JOIN "Customer" c ON c.id=o."customerId"
		%s GROUP BY c.id, c.name ORDER BY visits DESC LIMIT 10`, where), args...)
	type cvAgg struct {
		cid, name string
		visits    int64
		dayDist   []int64
	}
	var cvAggs []cvAgg
	if cvRows != nil {
		for cvRows.Next() {
			var a cvAgg
			if cvRows.Scan(&a.cid, &a.name, &a.visits) == nil {
				cvAggs = append(cvAggs, a)
			}
		}
		cvRows.Close()
	}
	// day distribution per customer
	for i := range cvAggs {
		ddArgs := []interface{}{cvAggs[i].cid, tenantID}
		ddWhere := `WHERE o."customerId" = $1 AND b."tenantId" = $2`
		if branchID != "" && branchID != "ALL" {
			ddWhere += fmt.Sprintf(` AND o."branchId" = $%d`, len(ddArgs)+1)
			ddArgs = append(ddArgs, branchID)
		}
		ddRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
			SELECT EXTRACT(DOW FROM COALESCE(o."receivedAt", o."createdAt"))::int AS dow, COUNT(*) AS cnt
			FROM "Order" o JOIN "Branch" b ON b.id=o."branchId"
			%s GROUP BY 1 ORDER BY 1`, ddWhere), ddArgs...)
		dist := []int64{}
		if ddRows != nil {
			for ddRows.Next() {
				var dow, cnt int
				if ddRows.Scan(&dow, &cnt) == nil {
					dist = append(dist, int64(cnt))
				}
			}
			ddRows.Close()
		}
		cvAggs[i].dayDist = dist
	}
	customerVisits := make([]interface{}, 0, len(cvAggs))
	for _, a := range cvAggs {
		customerVisits = append(customerVisits, map[string]interface{}{
			"customerId":      a.cid,
			"name":            a.name,
			"totalOrders":     a.visits,
			"dayDistribution": a.dayDist,
		})
	}
	// hourlyByDay: 7×24 matrix of order counts
	hbdRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT EXTRACT(DOW FROM COALESCE(o."receivedAt", o."createdAt"))::int,
		       EXTRACT(HOUR FROM COALESCE(o."receivedAt", o."createdAt"))::int,
		       COUNT(*)
		FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" %s GROUP BY 1, 2`, where), args...)
	hourlyByDay := [][]int{}
	for i := 0; i < 7; i++ {
		hourlyByDay = append(hourlyByDay, make([]int, 24))
	}
	if hbdRows != nil {
		for hbdRows.Next() {
			var dow, hr, cnt int
			if hbdRows.Scan(&dow, &hr, &cnt) == nil {
				if dow >= 0 && dow < 7 && hr >= 0 && hr < 24 {
					hourlyByDay[dow][hr] = cnt
				}
			}
		}
		hbdRows.Close()
	}
	// revenueByDay: revenue per day of week
	rbdRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT EXTRACT(DOW FROM COALESCE(o."receivedAt", o."createdAt"))::int,
		       COALESCE(SUM(o."totalAmount"::float), 0)
		FROM "Order" o JOIN "Branch" b ON b.id=o."branchId" %s GROUP BY 1 ORDER BY 1`, where), args...)
	revenueByDay := map[string]float64{}
	if rbdRows != nil {
		for rbdRows.Next() {
			var dow int
			var rev float64
			if rbdRows.Scan(&dow, &rev) == nil {
				revenueByDay[fmt.Sprintf("%d", dow)] = rev
			}
		}
		rbdRows.Close()
	}
	// revenueTrend: last 14 days (revenue + orders) with week-ago revenue for comparison.
	rtArgs := []interface{}{tenantID}
	rtBranch := ""
	if branchID != "" && branchID != "ALL" {
		rtBranch = fmt.Sprintf(` AND o."branchId" = $%d`, len(rtArgs)+1)
		rtArgs = append(rtArgs, branchID)
	}
	rtRows, _ := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT to_char(d, 'YYYY-MM-DD') AS date,
		       COUNT(DISTINCT o.id) AS orders,
		       COALESCE(SUM(o."totalAmount"::float), 0) AS revenue
		FROM generate_series(NOW() - interval '20 days', NOW(), '1 day') d
		LEFT JOIN "Order" o
		  ON o."branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $1%s)
		 AND COALESCE(o."receivedAt", o."createdAt")::date = d::date
		GROUP BY d ORDER BY d`, rtBranch), rtArgs...)
	type dayAgg struct {
		date    string
		orders  int64
		revenue float64
	}
	var days []dayAgg
	if rtRows != nil {
		for rtRows.Next() {
			var da dayAgg
			if rtRows.Scan(&da.date, &da.orders, &da.revenue) == nil {
				days = append(days, da)
			}
		}
		rtRows.Close()
	}
	revenueTrend := []interface{}{}
	for i := 7; i < len(days); i++ {
		revenueTrend = append(revenueTrend, map[string]interface{}{
			"date":            days[i].date,
			"orders":          days[i].orders,
			"revenue":         days[i].revenue,
			"previousRevenue": days[i-7].revenue,
		})
	}
	return map[string]interface{}{
		"customerVisits": customerVisits,
		"hourlyByDay":    hourlyByDay,
		"revenueByDay":   revenueByDay,
		"revenueTrend":   revenueTrend,
	}, nil
}

var _ = math.Round
