package infrastructure

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hivepos/api/internal/modules/dashboard/application"
	"github.com/hivepos/api/internal/modules/dashboard/domain"
)

type PgDashboardRepository struct {
	db *sql.DB
}

func NewPgDashboardRepository(db *sql.DB) *PgDashboardRepository {
	return &PgDashboardRepository{db: db}
}

// branchClause builds the optional branchId predicate. Returns "" when branchID
// is empty or "ALL" (all-outlets mode). The caller must keep arg indices in sync.
func branchClause(col string, branchID string, idx int) (string, []interface{}) {
	if branchID == "" || branchID == "ALL" {
		return "", nil
	}
	return fmt.Sprintf(` AND %s = $%d`, col, idx), []interface{}{branchID}
}

// GetStats runs the simplified headline aggregation. The TS original computes
// 17 metrics with previous-period comparison; this returns the current-period
// totals plus status/payment breakdowns — enough to render the dashboard cards.
func (r *PgDashboardRepository) GetStats(ctx context.Context, tenantID string, f application.StatsFilter) (*domain.Stats, error) {
	s := &domain.Stats{
		OrdersByStatus:   map[string]int64{},
		RevenueByStatus:  map[string]float64{},
		PaymentBreakdown: map[string]float64{},
	}

	// Build the orders WHERE clause with tenant + branch + module + date range.
	args := []interface{}{tenantID}
	idx := 2
	ordersWhere := `WHERE o."tenantId" = $1`
	if f.BranchID != "" && f.BranchID != "ALL" {
		ordersWhere += fmt.Sprintf(` AND o."branchId" = $%d`, idx)
		args = append(args, f.BranchID)
		idx++
	}
	if f.Module != "" {
		ordersWhere += fmt.Sprintf(` AND o.module = $%d`, idx)
		args = append(args, f.Module)
		idx++
	}
	// Date range: receivedAt with createdAt fallback (matches TS OR pattern).
	ordersWhere += fmt.Sprintf(` AND COALESCE(o."receivedAt", o."createdAt") >= $%d AND COALESCE(o."receivedAt", o."createdAt") <= $%d`, idx, idx+1)
	args = append(args, f.From+" 00:00:00", f.To+" 23:59:59")
	idx += 2

	// 1) Orders grouped by status: count + sum(totalAmount).
	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT o.status, COUNT(*), COALESCE(SUM(o."totalAmount"), 0)::float
		FROM "Order" o %s GROUP BY o.status`, ordersWhere), args...)
	if err != nil {
		return nil, fmt.Errorf("querying orders by status: %w", err)
	}
	for rows.Next() {
		var st string
		var cnt int64
		var sum float64
		if err := rows.Scan(&st, &cnt, &sum); err != nil {
			rows.Close()
			return nil, fmt.Errorf("scanning order status group: %w", err)
		}
		s.OrdersByStatus[st] = cnt
		s.RevenueByStatus[st] = sum
		s.TotalOrders += cnt
		s.TotalRevenue += sum
	}
	rows.Close()

	// 2) Payment breakdown by method (only PAID payments).
	pArgs := []interface{}{tenantID}
	pIdx := 2
	pWhere := `WHERE pay."tenantId" = $1 AND pay.status = 'PAID'`
	if f.BranchID != "" && f.BranchID != "ALL" {
		pWhere += fmt.Sprintf(` AND pay."branchId" = $%d`, pIdx)
		pArgs = append(pArgs, f.BranchID)
		pIdx++
	}
	pRows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT pay.method, COALESCE(SUM(pay.amount), 0)::float
		FROM "Payment" pay %s GROUP BY pay.method`, pWhere), pArgs...)
	if err != nil {
		return nil, fmt.Errorf("querying payment breakdown: %w", err)
	}
	for pRows.Next() {
		var method string
		var amt float64
		if err := pRows.Scan(&method, &amt); err != nil {
			pRows.Close()
			return nil, fmt.Errorf("scanning payment group: %w", err)
		}
		s.PaymentBreakdown[method] = amt
	}
	pRows.Close()

	// 3) Total customers (branch-shared, not module-scoped — matches TS note).
	cArgs := []interface{}{tenantID}
	cIdx := 2
	cWhere := `WHERE b."tenantId" = $1`
	if f.BranchID != "" && f.BranchID != "ALL" {
		cWhere += fmt.Sprintf(` AND c."branchId" = $%d`, cIdx)
		cArgs = append(cArgs, f.BranchID)
	}
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf(`
		SELECT COUNT(*) FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId" %s`, cWhere), cArgs...).Scan(&s.TotalCustomers); err != nil {
		return nil, fmt.Errorf("counting customers: %w", err)
	}

	// 4) Total expenses in the same window.
	eArgs := []interface{}{tenantID}
	eIdx := 2
	eWhere := `WHERE e."tenantId" = $1`
	if f.BranchID != "" && f.BranchID != "ALL" {
		eWhere += fmt.Sprintf(` AND e."branchId" = $%d`, eIdx)
		eArgs = append(eArgs, f.BranchID)
		eIdx++
	}
	eWhere += fmt.Sprintf(` AND e."date" >= $%d AND e."date" <= $%d`, eIdx, eIdx+1)
	eArgs = append(eArgs, f.From, f.To)
	if err := r.db.QueryRowContext(ctx, fmt.Sprintf(`
		SELECT COALESCE(SUM(e.amount), 0)::float FROM "Expense" e %s`, eWhere), eArgs...).Scan(&s.TotalExpenses); err != nil {
		// Expense table may not exist in all tenants — treat as 0 rather than failing the whole dashboard.
		s.TotalExpenses = 0
	}

	return s, nil
}

// GetKanban returns the live order pipeline grouped by status (date-unbound).
func (r *PgDashboardRepository) GetKanban(ctx context.Context, tenantID, branchID, module string) ([]*domain.KanbanEntry, error) {
	args := []interface{}{tenantID}
	idx := 2
	where := `WHERE o."tenantId" = $1`
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
		SELECT o.status, COUNT(*), COALESCE(SUM(o."totalAmount"), 0)::float
		FROM "Order" o %s GROUP BY o.status ORDER BY o.status`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("querying kanban: %w", err)
	}
	defer rows.Close()

	var list []*domain.KanbanEntry
	for rows.Next() {
		e := &domain.KanbanEntry{}
		if err := rows.Scan(&e.Status, &e.Count, &e.Sum); err != nil {
			return nil, fmt.Errorf("scanning kanban row: %w", err)
		}
		list = append(list, e)
	}
	return list, nil
}

// GetHeatmap aggregates order volume by day-of-week and hour.
func (r *PgDashboardRepository) GetHeatmap(ctx context.Context, tenantID, branchID string) ([]*domain.HeatmapPoint, error) {
	args := []interface{}{tenantID}
	idx := 2
	where := `WHERE o."tenantId" = $1`
	if branchID != "" && branchID != "ALL" {
		where += fmt.Sprintf(` AND o."branchId" = $%d`, idx)
		args = append(args, branchID)
	}

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT EXTRACT(DOW FROM COALESCE(o."receivedAt", o."createdAt"))::int AS dow,
		       EXTRACT(HOUR FROM COALESCE(o."receivedAt", o."createdAt"))::int AS hr,
		       COUNT(*)
		FROM "Order" o %s
		GROUP BY dow, hr ORDER BY dow, hr`, where), args...)
	if err != nil {
		return nil, fmt.Errorf("querying heatmap: %w", err)
	}
	defer rows.Close()

	var list []*domain.HeatmapPoint
	for rows.Next() {
		p := &domain.HeatmapPoint{}
		if err := rows.Scan(&p.DayOfWeek, &p.Hour, &p.Count); err != nil {
			return nil, fmt.Errorf("scanning heatmap row: %w", err)
		}
		list = append(list, p)
	}
	return list, nil
}
