package infrastructure

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/orders/application"
	"github.com/hivepos/api/internal/modules/orders/domain"
)

type PgOrderRepository struct {
	db *sql.DB
}

func NewPgOrderRepository(db *sql.DB) *PgOrderRepository {
	return &PgOrderRepository{db: db}
}

// List returns paginated orders for a tenant, optionally filtered by branch/status.
func (r *PgOrderRepository) List(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.Order, int64, error) {
	where := `WHERE o."tenantId" = $1`
	args := []interface{}{tenantID}
	argIdx := 2

	if filter.BranchID != "" && filter.BranchID != "ALL" {
		where += fmt.Sprintf(` AND o."branchId" = $%d`, argIdx)
		args = append(args, filter.BranchID)
		argIdx++
	}
	if filter.Status != "" {
		where += fmt.Sprintf(` AND o.status = $%d`, argIdx)
		args = append(args, filter.Status)
		argIdx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (c.name ILIKE $%d OR o."orderNumber" ILIKE $%d)`, argIdx, argIdx)
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	// Count total
	var total int64
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM "Order" o JOIN "Customer" c ON c.id = o."customerId" %s`, where)
	if err := r.db.QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting orders: %w", err)
	}

	// Fetch page
	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT o.id, o."orderNumber", o."customerId", o.status, o."paymentStatus",
		       o."totalAmount"::float, o."discountAmount"::float, o.notes, o."branchId", o."tenantId", o.module, o."createdAt", o."updatedAt",
		       c.name, c.phone
		FROM "Order" o
		JOIN "Customer" c ON c.id = o."customerId"
		%s
		ORDER BY o."createdAt" DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying orders: %w", err)
	}
	defer rows.Close()

	var orders []*domain.Order
	for rows.Next() {
		o := &domain.Order{}
		var customerName, customerPhone string
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.CustomerID, &o.Status, &o.PaymentStatus,
			&o.TotalAmount, &o.DiscountAmount, &o.Notes, &o.BranchID, &o.TenantID, &o.Module, &o.CreatedAt, &o.UpdatedAt,
			&customerName, &customerPhone,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning order: %w", err)
		}
		orders = append(orders, o)
	}

	return orders, total, nil
}

// FindByID returns a single order with its items, scoped to tenantID.
func (r *PgOrderRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.Order, error) {
	o := &domain.Order{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "orderNumber", "customerId", status, "paymentStatus",
		       "totalAmount"::float, "discountAmount"::float, notes, "branchId", "tenantId", module, "createdAt", "updatedAt"
		FROM "Order"
		WHERE id = $1 AND "tenantId" = $2`, id, tenantID,
	).Scan(
		&o.ID, &o.OrderNumber, &o.CustomerID, &o.Status, &o.PaymentStatus,
		&o.TotalAmount, &o.DiscountAmount, &o.Notes, &o.BranchID, &o.TenantID, &o.Module, &o.CreatedAt, &o.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding order: %w", err)
	}
	return o, nil
}

// FindByClientID checks idempotency (X-Client-Id header).
func (r *PgOrderRepository) FindByClientID(ctx context.Context, clientID string) (*domain.Order, error) {
	o := &domain.Order{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "orderNumber", "customerId", status, "paymentStatus",
		       "totalAmount"::float, "discountAmount"::float, notes, "branchId", "tenantId", module, "createdAt", "updatedAt"
		FROM "Order" WHERE "clientId" = $1`, clientID,
	).Scan(
		&o.ID, &o.OrderNumber, &o.CustomerID, &o.Status, &o.PaymentStatus,
		&o.TotalAmount, &o.DiscountAmount, &o.Notes, &o.BranchID, &o.TenantID, &o.Module, &o.CreatedAt, &o.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding order by clientId: %w", err)
	}
	return o, nil
}

// Create inserts an order + its items in a transaction.
func (r *PgOrderRepository) Create(ctx context.Context, order *domain.Order, items []domain.OrderItem) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning tx: %w", err)
	}
	defer tx.Rollback()

	// Allocate order number (ponytail: simple YYYYMMDD-NNNN, not the TS prefix-based system).
	now := time.Now()
	datePart := now.Format("20060102")
	var seq int
	if err := tx.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(seq), 0) + 1 FROM (
			SELECT ("orderNumber" ~ '^\d{8}-(\d+)$') AS match,
			       SUBSTRING("orderNumber" FROM '^\d{8}-(\d+)$') AS seq_str
			FROM "Order" WHERE "tenantId" = $1 AND "orderNumber" LIKE $2 || '-%'
		) sub WHERE match AND seq_str IS NOT NULL`,
		order.TenantID, datePart,
	).Scan(&seq); err != nil && err != sql.ErrNoRows {
		return fmt.Errorf("allocating order number: %w", err)
	}
	order.OrderNumber = fmt.Sprintf("%s-%04d", datePart, seq)

	// Insert order
	err = tx.QueryRowContext(ctx, `
		INSERT INTO "Order" ("orderNumber", "customerId", status, "paymentStatus",
			"totalAmount", "discountAmount", "discountType", notes, "branchId", "tenantId",
			module, "clientId", "receivedAt", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
		RETURNING id`,
		order.OrderNumber, order.CustomerID, order.Status, order.PaymentStatus,
		order.TotalAmount, order.DiscountAmount, nil, // discountType
		order.Notes, order.BranchID, order.TenantID,
		order.Module, order.ClientID, nil, // receivedAt
	).Scan(&order.ID)
	if err != nil {
		return fmt.Errorf("inserting order: %w", err)
	}

	// Insert items
	for _, item := range items {
		_, err = tx.ExecContext(ctx, `
			INSERT INTO "OrderItem" ("orderId", "serviceId", quantity, "weightKg", "pricePerUnit", subtotal)
			VALUES ($1, $2, $3, $4, $5, $6)`,
			order.ID, item.ServiceID, item.Quantity, item.WeightKg, item.PricePerUnit, item.Subtotal,
		)
		if err != nil {
			return fmt.Errorf("inserting order item: %w", err)
		}
	}

	return tx.Commit()
}

// UpdateStatus advances the order status.
func (r *PgOrderRepository) UpdateStatus(ctx context.Context, id, tenantID string, status domain.OrderStatus) error {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Order" SET status = $1, "updatedAt" = NOW()
		WHERE id = $2 AND "tenantId" = $3`, status, id, tenantID)
	if err != nil {
		return fmt.Errorf("updating status: %w", err)
	}
	return nil
}

// Delete soft-deletes or hard-deletes an order.
func (r *PgOrderRepository) Delete(ctx context.Context, id, tenantID string) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning tx: %w", err)
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, `DELETE FROM "OrderItem" WHERE "orderId" = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting items: %w", err)
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM "Payment" WHERE "orderId" = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting payments: %w", err)
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM "Order" WHERE id = $1 AND "tenantId" = $2`, id, tenantID)
	if err != nil {
		return fmt.Errorf("deleting order: %w", err)
	}

	return tx.Commit()
}
