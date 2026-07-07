package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
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

// whereClause builds the tenant + branch + date-range predicates for a report.
// All three column references are passed in already aliased (e.g. `o."tenantId"`,
// `o."branchId"`, `o."createdAt"`) so join queries work without post-rewriting.
// tenantID is bound to $1; branch/date follow at $2, $3, ... as needed.
// When neither startDate nor endDate is given, defaults to the last 30 days.
func whereClause(tenantID, tenantCol, branchCol, dateCol string, filter application.ReportFilter) (string, []interface{}) {
	args := []interface{}{tenantID}
	idx := 2
	clause := fmt.Sprintf(`%s = $1`, tenantCol)

	if filter.BranchID != "" && filter.BranchID != "ALL" {
		clause += fmt.Sprintf(` AND %s = $%d`, branchCol, idx)
		args = append(args, filter.BranchID)
		idx++
	}

	// ponytail: <ceiling> — date range uses naive comparison on the raw timestamp
	// column; no WIB timezone normalization. Acceptable for a v1 read port; pull
	// a tz-aware window when the dashboard needs day-boundary accuracy.
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
	default:
		clause += fmt.Sprintf(` AND %s >= NOW() - INTERVAL '30 days'`, dateCol)
	}
	return clause, args
}

// GetOrdersReport — order count + revenue + breakdown by status.
//
// Order has no tenantId column; tenant scoping joins "Branch" b ON b.id = o."branchId".
// The whereClause helper is given the already-aliased columns so the rendered
// SQL composes correctly into the FROM "Order" o JOIN "Branch" b shape.
func (r *PgReportsRepository) GetOrdersReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.OrdersReport, error) {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)

	// Aggregate totals
	var totalOrders int64
	var totalRevenue float64
	totQ := fmt.Sprintf(`
		SELECT COUNT(*), COALESCE(SUM(o."totalAmount"::float), 0)
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s`, where)
	if err := r.db.QueryRowContext(ctx, totQ, args...).Scan(&totalOrders, &totalRevenue); err != nil {
		return nil, fmt.Errorf("orders totals: %w", err)
	}

	// Breakdown by status
	bdQ := fmt.Sprintf(`
		SELECT o.status, COUNT(*)
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE %s
		GROUP BY o.status`, where)
	rows, err := r.db.QueryContext(ctx, bdQ, args...)
	if err != nil {
		return nil, fmt.Errorf("orders breakdown: %w", err)
	}
	defer rows.Close()

	byStatus := map[string]int64{}
	var breakdown []domain.StatusBreakdown
	for rows.Next() {
		var status string
		var count int64
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("scanning status breakdown: %w", err)
		}
		byStatus[status] = count
		breakdown = append(breakdown, domain.StatusBreakdown{Status: status, Count: count})
	}

	return &domain.OrdersReport{
		TotalOrders:  totalOrders,
		TotalRevenue: totalRevenue,
		ByStatus:     byStatus,
		Breakdown:    breakdown,
	}, nil
}

// GetRevenueReport — sum of PAID payments + breakdown by payment method.
func (r *PgReportsRepository) GetRevenueReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.RevenueReport, error) {
	// tenantId lives on Order, not Payment — join through Order.
	where, args := whereClause(tenantID, `o."tenantId"`, `o."branchId"`, `p."paidAt"`, filter)

	q := fmt.Sprintf(`
		SELECT p."paymentMethod", COALESCE(SUM(p.amount::float), 0)
		FROM "Payment" p
		JOIN "Order" o ON o.id = p."orderId"
		WHERE %s
		GROUP BY p."paymentMethod"`, where)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("revenue breakdown: %w", err)
	}
	defer rows.Close()

	byMethod := map[string]float64{}
	var breakdown []domain.MethodBreakdown
	var total float64
	for rows.Next() {
		var method string
		var amount float64
		if err := rows.Scan(&method, &amount); err != nil {
			return nil, fmt.Errorf("scanning revenue: %w", err)
		}
		byMethod[method] = amount
		breakdown = append(breakdown, domain.MethodBreakdown{Method: method, Amount: amount})
		total += amount
	}

	return &domain.RevenueReport{
		TotalRevenue: total,
		ByMethod:     byMethod,
		Breakdown:    breakdown,
	}, nil
}

// GetServicesReport — per-service usage (qty + revenue).
func (r *PgReportsRepository) GetServicesReport(ctx context.Context, tenantID string, filter application.ReportFilter) ([]domain.ServiceUsage, error) {
	where, args := whereClause(tenantID, `o."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)

	q := fmt.Sprintf(`
		SELECT s.id, s.name,
		       COALESCE(SUM(oi.quantity::float), 0) AS qty,
		       COALESCE(SUM(oi.subtotal::float), 0) AS revenue
		FROM "OrderItem" oi
		JOIN "Order" o ON o.id = oi."orderId"
		JOIN "Service" s ON s.id = oi."serviceId"
		WHERE %s
		GROUP BY s.id, s.name
		ORDER BY revenue DESC`, where)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("services report: %w", err)
	}
	defer rows.Close()

	var out []domain.ServiceUsage
	for rows.Next() {
		var u domain.ServiceUsage
		if err := rows.Scan(&u.ServiceID, &u.ServiceName, &u.Quantity, &u.Revenue); err != nil {
			return nil, fmt.Errorf("scanning service usage: %w", err)
		}
		out = append(out, u)
	}
	return out, nil
}

// GetCustomersReport — new + repeat counts + top 5 by order count.
func (r *PgReportsRepository) GetCustomersReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.CustomersReport, error) {
	where, args := whereClause(tenantID, `o."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)

	// New customers: first order within the window.
	var newCustomers int64
	newQ := fmt.Sprintf(`
		SELECT COUNT(DISTINCT o."customerId")
		FROM "Order" o
		JOIN "Customer" c ON c.id = o."customerId"
		WHERE %s
		  AND o."createdAt" = (
		    SELECT MIN(o2."createdAt") FROM "Order" o2 WHERE o2."customerId" = o."customerId"
		  )`, where)
	if err := r.db.QueryRowContext(ctx, newQ, args...).Scan(&newCustomers); err != nil {
		return nil, fmt.Errorf("new customers: %w", err)
	}

	// Repeat customers: more than one order within the window.
	var repeatCustomers int64
	repeatQ := fmt.Sprintf(`
		SELECT COUNT(*) FROM (
		  SELECT o."customerId"
		  FROM "Order" o WHERE %s
		  GROUP BY o."customerId"
		  HAVING COUNT(*) > 1
		) sub`, where)
	if err := r.db.QueryRowContext(ctx, repeatQ, args...).Scan(&repeatCustomers); err != nil {
		return nil, fmt.Errorf("repeat customers: %w", err)
	}

	// Top 5 by order count.
	topQ := fmt.Sprintf(`
		SELECT o."customerId", COALESCE(c.name, ''), COUNT(*) AS cnt,
		       COALESCE(SUM(o."totalAmount"::float), 0) AS spent
		FROM "Order" o
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		WHERE %s
		GROUP BY o."customerId", c.name
		ORDER BY cnt DESC
		LIMIT 5`, where)
	rows, err := r.db.QueryContext(ctx, topQ, args...)
	if err != nil {
		return nil, fmt.Errorf("top customers: %w", err)
	}
	defer rows.Close()

	var top []domain.TopCustomer
	for rows.Next() {
		var t domain.TopCustomer
		if err := rows.Scan(&t.CustomerID, &t.CustomerName, &t.OrderCount, &t.TotalSpent); err != nil {
			return nil, fmt.Errorf("scanning top customer: %w", err)
		}
		top = append(top, t)
	}

	return &domain.CustomersReport{
		NewCustomers:    newCustomers,
		RepeatCustomers: repeatCustomers,
		TopCustomers:    top,
	}, nil
}

// GetExpensesReport — total expenses + breakdown by category.
func (r *PgReportsRepository) GetExpensesReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.ExpensesReport, error) {
	// ponytail: <ceiling> — Expense has no tenantId column; scoped via join to
	// Branch on tenantId. For a v1 port we approximate tenant scoping by joining
	// Branch; upgrade when Expense gains a denormalized tenantId.
	where, args := whereClause(tenantID, `b."tenantId"`, `e."branchId"`, `e.date`, filter)

	q := fmt.Sprintf(`
		SELECT COALESCE(ec.name, 'Uncategorized') AS category,
		       COALESCE(SUM(e.amount::float), 0) AS amount
		FROM "Expense" e
		JOIN "Branch" b ON b.id = e."branchId"
		LEFT JOIN "ExpenseCategory" ec ON ec.id = e."categoryId"
		WHERE %s
		GROUP BY ec.name
		ORDER BY amount DESC`, where)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("expenses report: %w", err)
	}
	defer rows.Close()

	byCategory := map[string]float64{}
	var breakdown []domain.CategoryBreakdown
	var total float64
	for rows.Next() {
		var cat string
		var amount float64
		if err := rows.Scan(&cat, &amount); err != nil {
			return nil, fmt.Errorf("scanning expense: %w", err)
		}
		byCategory[cat] = amount
		breakdown = append(breakdown, domain.CategoryBreakdown{Category: cat, Amount: amount})
		total += amount
	}

	return &domain.ExpensesReport{
		TotalExpenses: total,
		ByCategory:    byCategory,
		Breakdown:     breakdown,
	}, nil
}

// GetMonthlyPnL — last 6 months revenue vs expenses.
func (r *PgReportsRepository) GetMonthlyPnL(ctx context.Context, tenantID string) ([]domain.MonthlyPnL, error) {
	// ponytail: <ceiling> — Expense tenant scoping is via Branch join; revenue
	// uses Order.tenantId directly. Different join shapes, two subqueries.
	q := `
		SELECT to_char(m.month, 'YYYY-MM') AS month,
		       COALESCE((
		         SELECT SUM(o."totalAmount"::float) FROM "Order" o
		         WHERE o."tenantId" = $1
		           AND date_trunc('month', o."createdAt") = m.month
		       ), 0) AS revenue,
		       COALESCE((
		         SELECT SUM(e.amount::float) FROM "Expense" e
		         JOIN "Branch" b ON b.id = e."branchId"
		         WHERE b."tenantId" = $1
		           AND date_trunc('month', e.date) = m.month
		       ), 0) AS expenses
		FROM generate_series(
		  date_trunc('month', NOW()) - INTERVAL '5 months',
		  date_trunc('month', NOW()),
		  INTERVAL '1 month'
		) AS m(month)
		ORDER BY m.month`

	rows, err := r.db.QueryContext(ctx, q, tenantID)
	if err != nil {
		return nil, fmt.Errorf("monthly pnl: %w", err)
	}
	defer rows.Close()

	var out []domain.MonthlyPnL
	for rows.Next() {
		var p domain.MonthlyPnL
		if err := rows.Scan(&p.Month, &p.Revenue, &p.Expenses); err != nil {
			return nil, fmt.Errorf("scanning pnl row: %w", err)
		}
		p.Profit = p.Revenue - p.Expenses
		out = append(out, p)
	}
	return out, nil
}

// GetProfitReport — revenue - expenses for a window.
func (r *PgReportsRepository) GetProfitReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.ProfitReport, error) {
	revWhere, revArgs := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
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

	return &domain.ProfitReport{
		TotalRevenue:  revenue,
		TotalExpenses: expenses,
		NetProfit:     revenue - expenses,
	}, nil
}

// GetOutstandingReport — sum of unpaid/partial orders.
func (r *PgReportsRepository) GetOutstandingReport(ctx context.Context, tenantID string, filter application.ReportFilter) (*domain.OutstandingReport, error) {
	where, args := whereClause(tenantID, `b."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)
	q := fmt.Sprintf(`
		SELECT COUNT(*), COALESCE(SUM(o."totalAmount"::float), 0)
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE %s AND o."paymentStatus" IN ('PENDING', 'PARTIAL')`, where)

	var rep domain.OutstandingReport
	if err := r.db.QueryRowContext(ctx, q, args...).Scan(&rep.OrderCount, &rep.TotalOutstanding); err != nil {
		return nil, fmt.Errorf("outstanding report: %w", err)
	}
	return &rep, nil
}

// GetPaymentCollection — collected today grouped by method.
func (r *PgReportsRepository) GetPaymentCollection(ctx context.Context, tenantID string) ([]domain.PaymentCollection, error) {
	q := `
		SELECT p."paymentMethod", COALESCE(SUM(p.amount::float), 0)
		FROM "Payment" p
		JOIN "Order" o ON o.id = p."orderId"
		WHERE o."tenantId" = $1 AND DATE(p."paidAt") = DATE(NOW())
		GROUP BY p."paymentMethod"
		ORDER BY p."paymentMethod"`

	rows, err := r.db.QueryContext(ctx, q, tenantID)
	if err != nil {
		return nil, fmt.Errorf("payment collection: %w", err)
	}
	defer rows.Close()

	var out []domain.PaymentCollection
	for rows.Next() {
		var c domain.PaymentCollection
		if err := rows.Scan(&c.Method, &c.Amount); err != nil {
			return nil, fmt.Errorf("scanning collection: %w", err)
		}
		out = append(out, c)
	}
	return out, nil
}

// GetCommissionReport — per-staff commission.
func (r *PgReportsRepository) GetCommissionReport(ctx context.Context, tenantID string, filter application.ReportFilter) ([]domain.CommissionRow, error) {
	// ponytail: <ceiling> — Order has no staffId column; commission grouping is
	// not possible against the current schema. Returns an empty slice rather than
	// fabricating data. Wire to a Staff/assignment table when one exists.
	_ = ctx
	_ = tenantID
	_ = filter
	return []domain.CommissionRow{}, nil
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
func (r *PgReportsRepository) GetInventoryReport(ctx context.Context, tenantID string) ([]domain.InventoryItem, error) {
	// ponytail: <ceiling> — no InventoryItem model exists in the schema yet.
	// Returns an empty list so the endpoint answers 200 with [] rather than 500.
	// Replace with a real query once the InventoryItem table is created.
	_ = ctx
	_ = tenantID
	return []domain.InventoryItem{}, nil
}

// GetPiutangReport — accounts receivable grouped by customer (UNPAID-ish orders).
func (r *PgReportsRepository) GetPiutangReport(ctx context.Context, tenantID string, filter application.ReportFilter) ([]domain.PiutangRow, error) {
	where, args := whereClause(tenantID, `o."tenantId"`, `o."branchId"`, `o."createdAt"`, filter)

	q := fmt.Sprintf(`
		SELECT o."customerId", COALESCE(c.name, ''),
		       COUNT(*) AS cnt, COALESCE(SUM(o."totalAmount"::float), 0) AS due
		FROM "Order" o
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		WHERE %s AND o."paymentStatus" IN ('PENDING', 'PARTIAL')
		GROUP BY o."customerId", c.name
		ORDER BY due DESC`, where)

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, fmt.Errorf("piutang report: %w", err)
	}
	defer rows.Close()

	var out []domain.PiutangRow
	for rows.Next() {
		var p domain.PiutangRow
		if err := rows.Scan(&p.CustomerID, &p.CustomerName, &p.OrderCount, &p.TotalDue); err != nil {
			return nil, fmt.Errorf("scanning piutang: %w", err)
		}
		out = append(out, p)
	}
	return out, nil
}

// GetFinancialStatement — combined aggregate.
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
	expenses, err := r.GetExpensesReport(ctx, tenantID, filter)
	if err != nil {
		return nil, err
	}

	return &domain.FinancialStatement{
		TotalRevenue:       profit.TotalRevenue,
		TotalExpenses:      profit.TotalExpenses,
		NetProfit:          profit.NetProfit,
		Outstanding:        outstanding.TotalOutstanding,
		RevenueByMethod:    revenue.ByMethod,
		ExpensesByCategory: expenses.ByCategory,
		GeneratedAt:        time.Now(),
	}, nil
}
