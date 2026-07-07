package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/customers/application"
	"github.com/hivepos/api/internal/modules/customers/domain"
)

type PgCustomerRepository struct {
	db *sql.DB
}

func NewPgCustomerRepository(db *sql.DB) *PgCustomerRepository {
	return &PgCustomerRepository{db: db}
}

func (r *PgCustomerRepository) Create(ctx context.Context, c *domain.Customer) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "Customer" (name, phone, email, notes, balance, "branchId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, 0, $5, NOW(), NOW()) RETURNING id, "createdAt", "updatedAt"`,
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
	if err == sql.ErrNoRows { return nil, nil }
	if err != nil { return nil, fmt.Errorf("finding customer: %w", err) }
	return c, nil
}

func (r *PgCustomerRepository) FindByPhone(ctx context.Context, phone, branchID string) (*domain.Customer, error) {
	c := &domain.Customer{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, phone, email, notes, balance::float, "branchId", "createdAt", "updatedAt"
		FROM "Customer" WHERE phone = $1 AND "branchId" = $2`, phone, branchID,
	).Scan(&c.ID, &c.Name, &c.Phone, &c.Email, &c.Notes, &c.Balance, &c.BranchID, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows { return nil, nil }
	if err != nil { return nil, err }
	return c, nil
}

func (r *PgCustomerRepository) FindByClientID(ctx context.Context, clientID string) (*domain.Customer, error) {
	c := &domain.Customer{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, phone, email, notes, balance::float, "branchId", "createdAt", "updatedAt"
		FROM "Customer" WHERE "clientId" = $1`, clientID,
	).Scan(&c.ID, &c.Name, &c.Phone, &c.Email, &c.Notes, &c.Balance, &c.BranchID, &c.CreatedAt, &c.UpdatedAt)
	if err == sql.ErrNoRows { return nil, nil }
	if err != nil { return nil, err }
	return c, nil
}

func (r *PgCustomerRepository) List(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.Customer, int64, error) {
	where := `WHERE b."tenantId" = $1`
	args := []interface{}{tenantID}
	idx := 2
	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND c."branchId" = $%d`, idx)
		args = append(args, filter.BranchID); idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (c.name ILIKE $%d OR c.phone ILIKE $%d)`, idx, idx)
		args = append(args, "%"+filter.Search+"%"); idx++
	}

	var total int64
	r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	orderBy := `c."createdAt" DESC`
	if filter.Sort == "name" { orderBy = `c.name` + descIfDesc(filter.Order) }
	if filter.Sort == "totalSpent" { orderBy = `c.balance` + descIfDesc(filter.Order) }

	query := fmt.Sprintf(`
		SELECT c.id, c.name, c.phone, c.email, c.notes, c.balance::float, c."branchId", c."createdAt", c."updatedAt"
		FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId"
		%s ORDER BY %s LIMIT $%d OFFSET $%d`, where, orderBy, idx, idx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil { return nil, 0, fmt.Errorf("querying customers: %w", err) }
	defer rows.Close()

	var list []*domain.Customer
	for rows.Next() {
		c := &domain.Customer{}
		if err := rows.Scan(&c.ID, &c.Name, &c.Phone, &c.Email, &c.Notes, &c.Balance, &c.BranchID, &c.CreatedAt, &c.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, c)
	}
	return list, total, nil
}

func (r *PgCustomerRepository) Update(ctx context.Context, c *domain.Customer) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Customer" SET name=$1, phone=$2, email=$3, notes=$4, "updatedAt"=NOW() WHERE id=$5`,
		c.Name, c.Phone, c.Email, c.Notes, c.ID)
	return err
}

func (r *PgCustomerRepository) Delete(ctx context.Context, id, tenantID string) error {
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
	if err != nil { return nil, err }
	return s, nil
}

func (r *PgCustomerRepository) GetDeposits(ctx context.Context, customerID, tenantID string) ([]*domain.DepositTransaction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT dt.id, dt."customerId", dt.type, dt.amount::float, dt."balanceAfter"::float, dt.notes, dt."createdAt"
		FROM "DepositTransaction" dt
		JOIN "Customer" c ON c.id = dt."customerId"
		JOIN "Branch" b ON b.id = c."branchId"
		WHERE dt."customerId" = $1 AND b."tenantId" = $2
		ORDER BY dt."createdAt" DESC LIMIT 50`, customerID, tenantID)
	if err != nil { return nil, err }
	defer rows.Close()
	var list []*domain.DepositTransaction
	for rows.Next() {
		d := &domain.DepositTransaction{}
		if err := rows.Scan(&d.ID, &d.CustomerID, &d.Type, &d.Amount, &d.BalanceAfter, &d.Notes, &d.CreatedAt); err != nil { return nil, err }
		list = append(list, d)
	}
	return list, nil
}

func (r *PgCustomerRepository) TopUpDeposit(ctx context.Context, customerID, tenantID string, amount float64, tType, notes string) (*domain.DepositTransaction, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil { return nil, err }
	defer tx.Rollback()

	var balanceAfter float64
	err = tx.QueryRowContext(ctx, `
		UPDATE "Customer" SET balance = balance + $1, "updatedAt" = NOW()
		WHERE id = $2 RETURNING balance::float`, amount, customerID).Scan(&balanceAfter)
	if err != nil { return nil, fmt.Errorf("updating balance: %w", err) }

	d := &domain.DepositTransaction{CustomerID: customerID, Type: tType, Amount: amount, BalanceAfter: balanceAfter}
	var notesVal interface{}
	if notes != "" { notesVal = notes }
	err = tx.QueryRowContext(ctx, `
		INSERT INTO "DepositTransaction" ("customerId", type, amount, "balanceAfter", notes, "createdAt")
		VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id, "createdAt"`,
		customerID, tType, amount, balanceAfter, notesVal).Scan(&d.ID, &d.CreatedAt)
	if err != nil { return nil, fmt.Errorf("inserting deposit tx: %w", err) }

	return d, tx.Commit()
}

func descIfDesc(order string) string {
	if order == "asc" { return " ASC" }
	return " DESC"
}

var _ time.Duration // keep time import for potential future use
