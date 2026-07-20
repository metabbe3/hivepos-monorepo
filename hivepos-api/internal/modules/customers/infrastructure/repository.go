package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/hivepos/api/internal/modules/customers/application"
	"github.com/hivepos/api/internal/modules/customers/domain"
	"github.com/hivepos/api/internal/shared/apperror"
)

type PgCustomerRepository struct {
	db *sql.DB
}

func NewPgCustomerRepository(db *sql.DB) *PgCustomerRepository {
	return &PgCustomerRepository{db: db}
}

func (r *PgCustomerRepository) Create(ctx context.Context, c *domain.Customer) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "Customer" (id, name, phone, email, notes, balance, "branchId", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, $5, NOW(), NOW()) RETURNING id, "createdAt", "updatedAt"`,
		c.Name, c.Phone, c.Email, c.Notes, c.BranchID,
	).Scan(&c.ID, &c.CreatedAt, &c.UpdatedAt)
}

func (r *PgCustomerRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.Customer, error) {
	c := &domain.Customer{}
	err := r.db.QueryRowContext(ctx, `
		SELECT c.id, c.name, c.phone, c.email, c.notes, c.balance::float, c."branchId", c."createdAt", c."updatedAt"
		FROM "Customer" c
		JOIN "Branch" b ON b.id = c."branchId"
		WHERE c.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&c.ID, &c.Name, &c.Phone, &c.Email, &c.Notes, &c.Balance, &c.BranchID, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding customer: %w", err)
	}

	// Attach order history (with item counts) for the detail view.
	ordRows, err := r.db.QueryContext(ctx, `
		SELECT o.id, o."orderNumber", o.status, o."totalAmount"::float, o."paidAmount"::float, o."createdAt",
		       (SELECT COUNT(*) FROM "OrderItem" WHERE "orderId" = o.id)
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o."customerId" = $1 AND b."tenantId" = $2
		ORDER BY o."createdAt" DESC`, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("querying customer orders: %w", err)
	}
	byID := make(map[string]*domain.CustomerOrder)
	var orderIDs []string
	for ordRows.Next() {
		o := &domain.CustomerOrder{Payments: []domain.CustomerPayment{}}
		if err := ordRows.Scan(&o.ID, &o.OrderNumber, &o.Status, &o.TotalAmount, &o.PaidAmount, &o.CreatedAt, &o.ItemCount); err != nil {
			ordRows.Close()
			return nil, fmt.Errorf("scanning customer order: %w", err)
		}
		byID[o.ID] = o
		orderIDs = append(orderIDs, o.ID)
	}
	if err := ordRows.Err(); err != nil {
		ordRows.Close()
		return nil, fmt.Errorf("iterating customer orders: %w", err)
	}
	ordRows.Close()

	// Attach payments grouped by order.
	c.Orders = make([]domain.CustomerOrder, 0, len(byID))
	if len(orderIDs) > 0 {
		payRows, err := r.db.QueryContext(ctx, `
			SELECT p.id, p.amount::float, p."paymentMethod", p."createdAt", p."orderId"
			FROM "Payment" p WHERE p."orderId" IN (`+joinQuotes(len(orderIDs))+`)
			ORDER BY p."createdAt" DESC`, strToIface(orderIDs)...)
		if err != nil {
			return nil, fmt.Errorf("querying customer payments: %w", err)
		}
		for payRows.Next() {
			var p domain.CustomerPayment
			var oid string
			if err := payRows.Scan(&p.ID, &p.Amount, &p.PaymentMethod, &p.CreatedAt, &oid); err != nil {
				payRows.Close()
				return nil, fmt.Errorf("scanning customer payment: %w", err)
			}
			if o, ok := byID[oid]; ok {
				o.Payments = append(o.Payments, p)
			}
		}
		if err := payRows.Err(); err != nil {
			payRows.Close()
			return nil, fmt.Errorf("iterating customer payments: %w", err)
		}
		payRows.Close()
	}
	// Preserve the DESC createdAt order from the orders query.
	for _, oid := range orderIDs {
		c.Orders = append(c.Orders, *byID[oid])
	}

	return c, nil
}

// joinQuotes builds "$1,$2,…" placeholder list of n placeholders.
func joinQuotes(n int) string {
	parts := make([]string, n)
	for i := 0; i < n; i++ {
		parts[i] = fmt.Sprintf("$%d", i+1)
	}
	return strings.Join(parts, ",")
}

// strToIface converts []string to []interface{} for variadic SQL args.
func strToIface(s []string) []interface{} {
	out := make([]interface{}, len(s))
	for i, v := range s {
		out[i] = v
	}
	return out
}

func (r *PgCustomerRepository) FindByPhone(ctx context.Context, phone, branchID string) (*domain.Customer, error) {
	c := &domain.Customer{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, phone, email, notes, balance::float, "branchId", "createdAt", "updatedAt"
		FROM "Customer" WHERE phone = $1 AND "branchId" = $2`, phone, branchID,
	).Scan(&c.ID, &c.Name, &c.Phone, &c.Email, &c.Notes, &c.Balance, &c.BranchID, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *PgCustomerRepository) FindByClientID(ctx context.Context, clientID string) (*domain.Customer, error) {
	c := &domain.Customer{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, phone, email, notes, balance::float, "branchId", "createdAt", "updatedAt"
		FROM "Customer" WHERE "clientId" = $1`, clientID,
	).Scan(&c.ID, &c.Name, &c.Phone, &c.Email, &c.Notes, &c.Balance, &c.BranchID, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return c, nil
}

func (r *PgCustomerRepository) List(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.Customer, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND c."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (c.name ILIKE $%d OR c.phone ILIKE $%d)`, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId" `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting customers: %w", err)
	}

	offset := (filter.Page - 1) * filter.Limit
	orderBy := `c."createdAt" DESC`
	if filter.Sort == "name" {
		orderBy = `c.name` + descIfDesc(filter.Order)
	}
	if filter.Sort == "totalSpent" {
		orderBy = `c.balance` + descIfDesc(filter.Order)
	}

	query := fmt.Sprintf(`
		SELECT c.id, c.name, c.phone, c.email, c.notes, c.balance::float, c."branchId", c."createdAt", c."updatedAt"
		FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId"
		%s ORDER BY %s`, where, orderBy)
	if !filter.All {
		query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, filter.Limit, offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying customers: %w", err)
	}
	defer rows.Close()

	var list []*domain.Customer
	for rows.Next() {
		c := &domain.Customer{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Phone, &c.Email, &c.Notes, &c.Balance, &c.BranchID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, fmt.Errorf("scanning customer: %w", err)
		}
		list = append(list, c)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating customers: %w", err)
	}
	return list, total, nil
}

// ListItems returns the curated customer DTO with order aggregates (matches TS
// /api/customers). customerStatus is derived by the service.
func (r *PgCustomerRepository) ListItems(ctx context.Context, tenantID string, filter application.ListFilter) ([]*application.CustomerListItem, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND c."branchId" = $%d`, idx)
		args = append(args, filter.BranchID)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (c.name ILIKE $%d OR c.phone ILIKE $%d)`, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	if err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId" `+where, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting customers: %w", err)
	}

	offset := (filter.Page - 1) * filter.Limit
	orderBy := `c."createdAt" DESC`
	if filter.Sort == "name" {
		orderBy = `c.name` + descIfDesc(filter.Order)
	}
	if filter.Sort == "totalSpent" {
		orderBy = `c.balance` + descIfDesc(filter.Order)
	}

	query := fmt.Sprintf(`
		SELECT c.id, c.name, c.phone, c.email, c.notes, c.balance::float, c."createdAt",
		       (SELECT COUNT(*) FROM "Order" o WHERE o."customerId" = c.id),
		       COALESCE((SELECT SUM(o."totalAmount") FROM "Order" o WHERE o."customerId" = c.id), 0)::float,
		       (SELECT MAX(o."createdAt") FROM "Order" o WHERE o."customerId" = c.id)
		FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId"
		%s ORDER BY %s`, where, orderBy)
	if !filter.All {
		query += fmt.Sprintf(` LIMIT $%d OFFSET $%d`, idx, idx+1)
		args = append(args, filter.Limit, offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying customer items: %w", err)
	}
	defer rows.Close()

	var out []*application.CustomerListItem
	for rows.Next() {
		it := &application.CustomerListItem{}
		if err := rows.Scan(&it.ID, &it.Name, &it.Phone, &it.Email, &it.Notes, &it.Balance, &it.CreatedAt,
			&it.TotalOrders, &it.TotalSpent, &it.LastOrderDate); err != nil {
			return nil, 0, fmt.Errorf("scanning customer item: %w", err)
		}
		out = append(out, it)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating customer items: %w", err)
	}
	return out, total, nil
}

func (r *PgCustomerRepository) Update(ctx context.Context, c *domain.Customer) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Customer" SET name=$1, phone=$2, email=$3, notes=$4, "updatedAt"=NOW() WHERE id=$5`,
		c.Name, c.Phone, c.Email, c.Notes, c.ID)
	return err
}

func (r *PgCustomerRepository) Delete(ctx context.Context, id, tenantID string) error {
	// Block deletion when the customer has orders — the FK would 500 otherwise.
	// The web's delete dialog catches BUSINESS_RULE_VIOLATION to show a "blocked" state.
	var orderCount int
	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM "Order" o
		JOIN "Branch" b ON b.id = o."branchId"
		WHERE o."customerId" = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&orderCount); err != nil {
		return fmt.Errorf("checking customer orders: %w", err)
	}
	if orderCount > 0 {
		return apperror.NewBusinessRule(fmt.Sprintf("Customer cannot be deleted because they have %d order(s).", orderCount))
	}
	_, err := r.db.ExecContext(ctx, `DELETE FROM "Customer" c USING "Branch" b WHERE c.id=$1 AND b.id=c."branchId" AND b."tenantId"=$2`, id, tenantID)
	return err
}

func (r *PgCustomerRepository) GetStats(ctx context.Context, id, tenantID string) (*domain.CustomerStats, error) {
	s := &domain.CustomerStats{}
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(o.id), COALESCE(SUM(o."totalAmount"), 0)::float, MAX(o."createdAt")
		FROM "Order" o
		JOIN "Branch" b ON b.id = o."branchId"
		WHERE o."customerId" = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&s.TotalOrders, &s.TotalSpent, &s.LastOrderDate)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *PgCustomerRepository) GetDeposits(ctx context.Context, customerID, tenantID string) ([]*domain.DepositTransaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT dt.id, dt."customerId", dt.type, dt.amount::float, dt."balanceAfter"::float, COALESCE(dt.description, dt.notes), dt."createdAt"
		FROM "DepositTransaction" dt
		JOIN "Customer" c ON c.id = dt."customerId"
		JOIN "Branch" b ON b.id = c."branchId"
		WHERE dt."customerId" = $1 AND b."tenantId" = $2
		ORDER BY dt."createdAt" DESC LIMIT 50`, customerID, tenantID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*domain.DepositTransaction
	for rows.Next() {
		d := &domain.DepositTransaction{}
		if err := rows.Scan(&d.ID, &d.CustomerID, &d.Type, &d.Amount, &d.BalanceAfter, &d.Notes, &d.CreatedAt); err != nil {
			return nil, err
		}
		list = append(list, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating deposits: %w", err)
	}
	return list, nil
}

func (r *PgCustomerRepository) TopUpDeposit(ctx context.Context, customerID, tenantID string, amount float64, tType, notes string) (*domain.DepositTransaction, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var balanceAfter float64
	var branchID string
	err = tx.QueryRowContext(ctx, `
		UPDATE "Customer" SET balance = balance + $1, "updatedAt" = NOW()
		WHERE id = $2 AND "branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $3)
		RETURNING balance::float, "branchId"`, amount, customerID, tenantID).Scan(&balanceAfter, &branchID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("customer does not belong to tenant")
	}
	if err != nil {
		return nil, fmt.Errorf("updating balance: %w", err)
	}

	d := &domain.DepositTransaction{CustomerID: customerID, Type: tType, Amount: amount, BalanceAfter: balanceAfter}
	var notesVal interface{}
	if notes != "" {
		notesVal = notes
	}
	err = tx.QueryRowContext(ctx, `
		INSERT INTO "DepositTransaction" (id, "customerId", "branchId", type, amount, "balanceAfter", notes, description, "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $6, NOW()) RETURNING id, "createdAt"`,
		customerID, branchID, tType, amount, balanceAfter, notesVal).Scan(&d.ID, &d.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("inserting deposit tx: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing deposit top-up: %w", err)
	}
	return d, nil
}

func descIfDesc(order string) string {
	if order == "asc" {
		return " ASC"
	}
	return " DESC"
}

var _ time.Duration // keep time import for potential future use
