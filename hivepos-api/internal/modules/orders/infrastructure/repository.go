package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
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
//
// Order has no tenantId column (Prisma models it via the Branch relation), so
// tenant scoping joins "Branch" b ON b.id = o."branchId" and filters b."tenantId".
// The tenantId on the returned aggregate is backfilled from the Branch row.
func (r *PgOrderRepository) List(ctx context.Context, tenantID string, filter application.ListFilter) ([]*domain.Order, int64, error) {
	where := `WHERE b."tenantId" = $1`
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
	if filter.PaymentStatus != "" {
		where += fmt.Sprintf(` AND o."paymentStatus" = $%d`, argIdx)
		args = append(args, filter.PaymentStatus)
		argIdx++
	}
	if filter.DateFrom != "" {
		where += fmt.Sprintf(` AND o."createdAt" >= $%d::timestamptz`, argIdx)
		args = append(args, filter.DateFrom)
		argIdx++
	}
	if filter.DateTo != "" {
		where += fmt.Sprintf(` AND o."createdAt" <= $%d::timestamptz`, argIdx)
		args = append(args, filter.DateTo+" 23:59:59")
		argIdx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (c.name ILIKE $%d OR o."orderNumber" ILIKE $%d OR c.phone ILIKE $%d)`, argIdx, argIdx, argIdx)
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	// Count total
	var total int64
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM "Order" o JOIN "Customer" c ON c.id = o."customerId" JOIN "Branch" b ON b.id = o."branchId" %s`, where)
	if err := r.db.QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting orders: %w", err)
	}

	// Fetch page
	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT o.id, o."orderNumber", o."customerId", o.status, o."paymentStatus",
		       o."totalAmount"::float, o."discountAmount"::float, o.notes, o."branchId", b."tenantId", o.module, o."createdAt", o."updatedAt",
		       c.name, c.phone
		FROM "Order" o
		JOIN "Customer" c ON c.id = o."customerId"
		JOIN "Branch" b ON b.id = o."branchId"
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
		var customerName, customerPhone, notes sql.NullString
		if err := rows.Scan(
			&o.ID, &o.OrderNumber, &o.CustomerID, &o.Status, &o.PaymentStatus,
			&o.TotalAmount, &o.DiscountAmount, &notes, &o.BranchID, &o.TenantID, &o.Module, &o.CreatedAt, &o.UpdatedAt,
			&customerName, &customerPhone,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning order: %w", err)
		}
		o.Notes = notes.String
		orders = append(orders, o)
	}

	return orders, total, nil
}

// ListItems returns the curated OrderRecord DTO list (matches TS OrderRecord for a
// user who can see financials). Selects the full TS field set incl. customer join.
func (r *PgOrderRepository) ListItems(ctx context.Context, tenantID string, filter application.ListFilter) ([]*application.OrderListItem, int64, error) {
	where := `WHERE b."tenantId" = $1`
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
	if filter.PaymentStatus != "" {
		where += fmt.Sprintf(` AND o."paymentStatus" = $%d`, argIdx)
		args = append(args, filter.PaymentStatus)
		argIdx++
	}
	if filter.DateFrom != "" {
		where += fmt.Sprintf(` AND o."createdAt" >= $%d::timestamptz`, argIdx)
		args = append(args, filter.DateFrom)
		argIdx++
	}
	if filter.DateTo != "" {
		where += fmt.Sprintf(` AND o."createdAt" <= $%d::timestamptz`, argIdx)
		args = append(args, filter.DateTo+" 23:59:59")
		argIdx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (c.name ILIKE $%d OR o."orderNumber" ILIKE $%d OR c.phone ILIKE $%d)`, argIdx, argIdx, argIdx)
		args = append(args, "%"+filter.Search+"%")
		argIdx++
	}

	var total int64
	countQ := fmt.Sprintf(`SELECT COUNT(*) FROM "Order" o JOIN "Customer" c ON c.id = o."customerId" JOIN "Branch" b ON b.id = o."branchId" %s`, where)
	if err := r.db.QueryRowContext(ctx, countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting orders: %w", err)
	}

	offset := (filter.Page - 1) * filter.Limit
	query := fmt.Sprintf(`
		SELECT o.id, o."orderNumber", o."customerId", c.name, c.phone, o.status, o.module,
		       o."totalAmount"::float, o."paidAmount"::float, o."discountAmount"::float, o."discountType",
		       o."paymentStatus", o.notes, o."receivedAt", o."createdAt", o."updatedAt"
		FROM "Order" o
		JOIN "Customer" c ON c.id = o."customerId"
		JOIN "Branch" b ON b.id = o."branchId"
		%s
		ORDER BY o."createdAt" DESC
		LIMIT $%d OFFSET $%d`, where, argIdx, argIdx+1)
	args = append(args, filter.Limit, offset)

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying order items: %w", err)
	}
	defer rows.Close()

	var out []*application.OrderListItem
	for rows.Next() {
		it := &application.OrderListItem{}
		var notes sql.NullString
		if err := rows.Scan(
			&it.ID, &it.OrderNumber, &it.CustomerID, &it.CustomerName, &it.CustomerPhone,
			&it.Status, &it.Module,
			&it.TotalAmount, &it.PaidAmount, &it.DiscountAmount, &it.DiscountType,
			&it.PaymentStatus, &notes, &it.ReceivedAt, &it.CreatedAt, &it.UpdatedAt,
		); err != nil {
			return nil, 0, fmt.Errorf("scanning order item: %w", err)
		}
		if notes.Valid {
			n := notes.String
			it.Notes = &n
		}
		out = append(out, it)
	}
	return out, total, nil
}

// FindByID returns a single order with its items, scoped to tenantID via Branch.
func (r *PgOrderRepository) FindByID(ctx context.Context, id, tenantID string) (*domain.Order, error) {
	o := &domain.Order{}
	var notes sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT o.id, o."orderNumber", o."customerId", o.status, o."paymentStatus",
		       o."totalAmount"::float, o."discountAmount"::float, o.notes, o."branchId", b."tenantId", o.module, o."createdAt", o."updatedAt"
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(
		&o.ID, &o.OrderNumber, &o.CustomerID, &o.Status, &o.PaymentStatus,
		&o.TotalAmount, &o.DiscountAmount, &notes, &o.BranchID, &o.TenantID, &o.Module, &o.CreatedAt, &o.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding order: %w", err)
	}
	o.Notes = notes.String
	return o, nil
}

// FindDetailByID returns the rich order shape (items + customer + payments + branch
// fields) the web's order detail / receipt / edit pages consume.
func (r *PgOrderRepository) FindDetailByID(ctx context.Context, id, tenantID string) (*application.OrderDetail, error) {
	d := &application.OrderDetail{OrderItems: []application.OrderItemDetail{}, Payments: []application.OrderPaymentDetail{}}
	var discountType, notes, custName, custPhone, invoiceFooter, paperSize sql.NullString
	var receivedAt, inProgressAt, readyAt, deliveredAt sql.NullTime
	var createdAt time.Time
	err := r.db.QueryRowContext(ctx, `
		SELECT o.id, o."orderNumber", o.status::text, o."totalAmount"::float, o."discountAmount"::float,
		       o."discountType", o."paidAmount"::float, o."paymentStatus"::text, o.notes,
		       o."createdAt", o."receivedAt", o."inProgressAt", o."readyAt", o."deliveredAt",
		       o."customerId", c.name, c.phone, c.balance::float,
		       b."invoiceFooter", b."printerPaperSize"
		FROM "Order" o
		JOIN "Customer" c ON c.id = o."customerId"
		JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&d.ID, &d.OrderNumber, &d.Status, &d.TotalAmount, &d.DiscountAmount,
		&discountType, &d.PaidAmount, &d.PaymentStatus, &notes,
		&createdAt, &receivedAt, &inProgressAt, &readyAt, &deliveredAt,
		&d.CustomerID, &custName, &custPhone, &d.CustomerBalance,
		&invoiceFooter, &paperSize)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding order detail: %w", err)
	}
	d.CreatedAt = createdAt.UTC().Format(time.RFC3339)
	d.DiscountType = nsPtr(discountType)
	d.Notes = nsPtr(notes)
	d.CustomerName = custName.String
	d.CustomerPhone = nsPtr(custPhone)
	d.InvoiceFooter = nsPtr(invoiceFooter)
	d.PrinterPaperSize = nsPtr(paperSize)
	d.ReceivedAt = tPtr(receivedAt)
	d.InProgressAt = tPtr(inProgressAt)
	d.ReadyAt = tPtr(readyAt)
	d.DeliveredAt = tPtr(deliveredAt)

	irows, err := r.db.QueryContext(ctx, `
		SELECT oi.id, oi."serviceId", s.name, oi.quantity::float, oi."weightKg"::float,
		       oi."pricePerUnit"::float, oi.subtotal::float, oi.notes, oi."garmentBreakdown"
		FROM "OrderItem" oi JOIN "Service" s ON s.id = oi."serviceId"
		WHERE oi."orderId" = $1 ORDER BY oi.id`, id)
	if err != nil {
		return nil, fmt.Errorf("querying order items: %w", err)
	}
	defer irows.Close()
	for irows.Next() {
		var it application.OrderItemDetail
		var weight sql.NullFloat64
		var inNotes sql.NullString
		var gb []byte
		if err := irows.Scan(&it.ID, &it.ServiceID, &it.ServiceName, &it.Quantity, &weight, &it.PricePerUnit, &it.Subtotal, &inNotes, &gb); err != nil {
			return nil, fmt.Errorf("scanning order item: %w", err)
		}
		if weight.Valid {
			w := weight.Float64
			it.WeightKg = &w
		}
		it.Notes = nsPtr(inNotes)
		if len(gb) > 0 {
			it.GarmentBreakdown = json.RawMessage(gb)
		} else {
			it.GarmentBreakdown = json.RawMessage("null")
		}
		d.OrderItems = append(d.OrderItems, it)
	}

	prows, err := r.db.QueryContext(ctx, `
		SELECT id, amount::float, "paymentMethod"::text, notes, "paidAt"
		FROM "Payment" WHERE "orderId" = $1 ORDER BY "paidAt" DESC`, id)
	if err != nil {
		return nil, fmt.Errorf("querying payments: %w", err)
	}
	defer prows.Close()
	for prows.Next() {
		var p application.OrderPaymentDetail
		var pNotes sql.NullString
		var paidAt sql.NullTime
		if err := prows.Scan(&p.ID, &p.Amount, &p.PaymentMethod, &pNotes, &paidAt); err != nil {
			return nil, fmt.Errorf("scanning payment: %w", err)
		}
		p.Notes = nsPtr(pNotes)
		if paidAt.Valid {
			p.PaidAt = paidAt.Time.UTC().Format(time.RFC3339)
		}
		d.Payments = append(d.Payments, p)
	}
	return d, nil
}

func nsPtr(s sql.NullString) *string {
	if !s.Valid || s.String == "" {
		return nil
	}
	v := s.String
	return &v
}
func tPtr(t sql.NullTime) *string {
	if !t.Valid {
		return nil
	}
	v := t.Time.UTC().Format(time.RFC3339)
	return &v
}

// FindByClientID checks idempotency (X-Client-Id header).
func (r *PgOrderRepository) FindByClientID(ctx context.Context, clientID string) (*domain.Order, error) {
	o := &domain.Order{}
	var notes sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT o.id, o."orderNumber", o."customerId", o.status, o."paymentStatus",
		       o."totalAmount"::float, o."discountAmount"::float, o.notes, o."branchId", b."tenantId", o.module, o."createdAt", o."updatedAt"
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o."clientId" = $1`, clientID,
	).Scan(
		&o.ID, &o.OrderNumber, &o.CustomerID, &o.Status, &o.PaymentStatus,
		&o.TotalAmount, &o.DiscountAmount, &notes, &o.BranchID, &o.TenantID, &o.Module, &o.CreatedAt, &o.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding order by clientId: %w", err)
	}
	o.Notes = notes.String
	return o, nil
}

// Create inserts an order + its items in a transaction.
func (r *PgOrderRepository) Create(ctx context.Context, order *domain.Order, items []domain.OrderItem) error {
	// Ownership guard: customer must belong to the order's tenant (prevents cross-tenant order
	// creation by spoofing customerId).
	var custOK int
	if err := r.db.QueryRowContext(ctx, `
		SELECT 1 FROM "Customer" c JOIN "Branch" b ON b.id = c."branchId"
		WHERE c.id = $1 AND b."tenantId" = $2`, order.CustomerID, order.TenantID,
	).Scan(&custOK); err != nil {
		return fmt.Errorf("customer does not belong to tenant")
	}
	// Price items from Service.basePrice BEFORE opening the tx — one IN(...) query instead of
	// N per-item queries holding the tx (and its locks) open. The web create omits per-unit prices.
	// Scoped by tenant so a spoofed serviceId from another tenant is "not found".
	type svcPrice struct{ base float64; pt string }
	priceMap := map[string]svcPrice{}
	if len(items) > 0 {
		ph := make([]string, len(items))
		args := make([]interface{}, len(items))
		for i := range items {
			ph[i] = fmt.Sprintf("$%d", i+1)
			args[i] = items[i].ServiceID
		}
		prRows, prErr := r.db.QueryContext(ctx,
			fmt.Sprintf(`SELECT s.id, s."basePrice"::float, s."pricingType" FROM "Service" s JOIN "Branch" b ON b.id = s."branchId" WHERE s.id IN (%s) AND b."tenantId" = $%d`, strings.Join(ph, ","), len(args)+1),
			append(args, order.TenantID)...)
		if prErr != nil {
			return fmt.Errorf("pricing services: %w", prErr)
		}
		for prRows.Next() {
			var id, pt string
			var base float64
			if err := prRows.Scan(&id, &base, &pt); err != nil {
				prRows.Close()
				return fmt.Errorf("scanning service price: %w", err)
			}
			priceMap[id] = svcPrice{base: base, pt: pt}
		}
		prRows.Close()
	}
	gross := 0.0
	for i := range items {
		sp, ok := priceMap[items[i].ServiceID]
		if !ok {
			return fmt.Errorf("pricing service %s: not found", items[i].ServiceID)
		}
		items[i].PricePerUnit = sp.base
		items[i].Subtotal = sp.base * effectiveQty(sp.pt, items[i].Quantity, items[i].WeightKg)
		gross += items[i].Subtotal
	}
	order.DiscountAmount = cappedDiscount(gross, order.DiscountType, order.DiscountAmount)
	order.TotalAmount = gross - order.DiscountAmount

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("beginning tx: %w", err)
	}
	defer tx.Rollback()

	// Allocate order number: {tenantCode}-YYYYMMDD-NNNN (matches TS order-number.vo).
	// tenantCode is derived from the tenant slug (initials). Sequence is per-(tenant,date);
	// the tenant prefix disambiguates under the global Order_orderNumber_key unique constraint.
	var slug string
	if err := tx.QueryRowContext(ctx, `SELECT slug FROM "Tenant" WHERE id = $1`, order.TenantID).Scan(&slug); err != nil {
		return fmt.Errorf("loading tenant slug for order number: %w", err)
	}
	// Order-number date follows the (possibly backdated) receivedAt — matches TS.
	dateForNumber := time.Now().UTC()
	if order.ReceivedAt != nil {
		dateForNumber = order.ReceivedAt.UTC()
	}
	prefix := domain.OrderNumberPrefix(dateForNumber, domain.DeriveTenantCode(slug))
	// Advisory lock on the prefix serializes per-(tenant,date) allocation across concurrent
	// cashiers (READ COMMITTED doesn't block two txns reading the same MAX). Transaction-scoped.
	if _, err := tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock(hashtext($1))`, prefix); err != nil {
		return fmt.Errorf("order-number lock: %w", err)
	}
	var seq int
	if err := tx.QueryRowContext(ctx, `
		SELECT COALESCE(MAX(SUBSTRING("orderNumber" FROM '(\d+)$')::int), 0) + 1
		FROM "Order" WHERE "orderNumber" LIKE $1 || '%'`, prefix,
	).Scan(&seq); err != nil {
		return fmt.Errorf("allocating order number: %w", err)
	}
	order.OrderNumber = fmt.Sprintf("%s%04d", prefix, seq)

	// Insert order (Order has NO tenantId column — tenant lives on Branch; omitted here)
	err = tx.QueryRowContext(ctx, `
		INSERT INTO "Order" (id, "orderNumber", "customerId", status, "paymentStatus",
			"totalAmount", "discountAmount", "discountType", notes, "branchId",
			module, "clientId", "receivedAt", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, NULLIF($7,''), $8, $9, $10, $11, COALESCE($12, NOW()), NOW(), NOW())
		RETURNING id`,
		order.OrderNumber, order.CustomerID, order.Status, order.PaymentStatus,
		order.TotalAmount, order.DiscountAmount, order.DiscountType,
		order.Notes, order.BranchID,
		order.Module, order.ClientID, order.ReceivedAt,
	).Scan(&order.ID)
	if err != nil {
		return fmt.Errorf("inserting order: %w", err)
	}

	// Insert items
	for _, item := range items {
		var gbArg interface{}
		if len(item.GarmentBreakdown) > 0 && string(item.GarmentBreakdown) != "null" {
			gbArg = string(item.GarmentBreakdown) // text → jsonb
		}
		_, err = tx.ExecContext(ctx, `
			INSERT INTO "OrderItem" (id, "orderId", "serviceId", quantity, "weightKg", "pricePerUnit", subtotal, "garmentBreakdown")
			VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)`,
			order.ID, item.ServiceID, item.Quantity, item.WeightKg, item.PricePerUnit, item.Subtotal, gbArg,
		)
		if err != nil {
			return fmt.Errorf("inserting order item: %w", err)
		}
	}

	return tx.Commit()
}

// UpdateStatus advances the order status. Tenant scoping uses a Branch subquery
// because Order has no tenantId column (it lives on the related Branch).
func (r *PgOrderRepository) UpdateStatus(ctx context.Context, id, tenantID string, status domain.OrderStatus) error {
	var current domain.OrderStatus
	if err := r.db.QueryRowContext(ctx, `
		SELECT o.status FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&current); err != nil {
		return fmt.Errorf("finding order status: %w", err)
	}
	if !canTransition(current, status) {
		return fmt.Errorf("invalid status transition: %s → %s", current, status)
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Order" SET status = $1, "updatedAt" = NOW()
		WHERE id = $2 AND "branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $3)`,
		status, id, tenantID)
	if err != nil {
		return fmt.Errorf("updating status: %w", err)
	}
	return nil
}

// canTransition enforces the order state machine (forward flow + cancel), matching the TS
// advance-status service. DELIVERED + CANCELED are terminal.
func canTransition(from, to domain.OrderStatus) bool {
	if from == to {
		return true
	}
	rank := map[domain.OrderStatus]int{
		domain.StatusReceived: 0, domain.StatusInProgress: 1,
		domain.StatusReady: 2, domain.StatusDelivered: 3, domain.StatusCanceled: -1,
	}
	// Cancel is allowed from any active (non-terminal) state.
	if to == domain.StatusCanceled && from != domain.StatusDelivered && from != domain.StatusCanceled {
		return true
	}
	fr, fok := rank[from]
	to2, tok := rank[to]
	if !fok || !tok {
		return false
	}
	// Forward progression only (skip-ahead allowed for express flows).
	return to2 > fr
}

// effectiveQty returns the pricing multiplier: weightKg for PER_KG services, quantity otherwise.
func effectiveQty(pt string, qty float64, weightKg *float64) float64 {
	if pt == "PER_KG" && weightKg != nil && *weightKg > 0 {
		return *weightKg
	}
	return qty
}

// cappedDiscount computes the discount (PERCENTAGE or FIXED) capped at gross → no negative totals.
func cappedDiscount(gross float64, discountType string, discountAmount float64) float64 {
	d := discountAmount
	if discountType == "PERCENTAGE" {
		d = gross * discountAmount / 100.0
	}
	if d > gross {
		d = gross
	}
	return d
}

// refundDeposit restores amount to the customer wallet + writes a REFUND DepositTransaction.
// Shared by order Delete + VoidPayment (RecordPayment deducts separately with a sufficiency guard).
func refundDeposit(ctx context.Context, tx *sql.Tx, customerID, branchID, orderID string, amount float64, notes string) error {
	var balAfter float64
	if err := tx.QueryRowContext(ctx,
		`UPDATE "Customer" SET balance = balance + $1, "updatedAt" = NOW() WHERE id = $2 RETURNING balance::float`,
		amount, customerID,
	).Scan(&balAfter); err != nil {
		return fmt.Errorf("refunding deposit: %w", err)
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO "DepositTransaction" (id, "customerId", "branchId", type, amount, "balanceAfter", "orderId", notes, "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'REFUND', $3, $4, $5, $6, NOW())`,
		customerID, branchID, amount, balAfter, orderID, notes); err != nil {
		return fmt.Errorf("inserting deposit refund: %w", err)
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

	// Guard: confirm the order belongs to the tenant before cascading deletes.
	var belongs int
	if err := tx.QueryRowContext(ctx, `
		SELECT 1 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2`, id, tenantID).Scan(&belongs); err == sql.ErrNoRows {
		return tx.Commit() // not found / not in tenant — nothing to delete
	} else if err != nil {
		return fmt.Errorf("checking order ownership: %w", err)
	}

	// Refund any DEPOSIT payments to the customer wallet (+ audit) before the
	// payments are destroyed — otherwise deleting the order loses that money.
	var refund float64
	var custID, brID string
	if err := tx.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(p.amount::float), 0), o."customerId", o."branchId"
		FROM "Order" o
		LEFT JOIN "Payment" p ON p."orderId" = o.id AND p."paymentMethod" = 'DEPOSIT'
		WHERE o.id = $1
		GROUP BY o."customerId", o."branchId"`, id,
	).Scan(&refund, &custID, &brID); err != nil {
		return fmt.Errorf("computing deposit refund: %w", err)
	}
	if refund > 0 {
		if err := refundDeposit(ctx, tx, custID, brID, id, refund, "order deleted"); err != nil {
			return err
		}
	}

	_, err = tx.ExecContext(ctx, `DELETE FROM "OrderItem" WHERE "orderId" = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting items: %w", err)
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM "Payment" WHERE "orderId" = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting payments: %w", err)
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM "Order" WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting order: %w", err)
	}

	return tx.Commit()
}

// RecordPayment inserts a Payment, bumps the order's paidAmount, and recomputes
// paymentStatus (PAID / PARTIAL). Mirrors the legacy POST /api/orders/[id]/payments.
func (r *PgOrderRepository) RecordPayment(ctx context.Context, id, tenantID string, amount float64, method, notes string, paidAt *time.Time) (*domain.Order, error) {
	if method == "" {
		method = "CASH"
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning tx: %w", err)
	}
	defer tx.Rollback()

	var total, oldPaid float64
	var customerID, branchID string
	err = tx.QueryRowContext(ctx, `
		SELECT o."totalAmount"::float, o."paidAmount"::float, o."customerId", o."branchId"
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2 FOR UPDATE`, id, tenantID,
	).Scan(&total, &oldPaid, &customerID, &branchID)
	if err != nil {
		return nil, fmt.Errorf("finding order for payment: %w", err)
	}
	// Overpayment guard — never accept more than the remaining balance.
	if oldPaid+amount > total+1e-9 {
		return nil, fmt.Errorf("payment amount exceeds remaining balance")
	}

	var notesArg any
	if notes != "" {
		notesArg = notes
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO "Payment" (id, "orderId", amount, "paymentMethod", notes, "paidAt", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, COALESCE($5, NOW()), NOW())`,
		id, amount, method, notesArg, paidAt); err != nil {
		return nil, fmt.Errorf("inserting payment: %w", err)
	}

	// DEPOSIT: deduct the customer wallet atomically + write an audit row. Reject overdraft.
	if method == "DEPOSIT" {
		var balance float64
		if err := tx.QueryRowContext(ctx, `
			SELECT balance::float FROM "Customer" WHERE id = $1 FOR UPDATE`, customerID,
		).Scan(&balance); err != nil {
			return nil, fmt.Errorf("locking customer for deposit: %w", err)
		}
		if balance < amount {
			return nil, fmt.Errorf("insufficient deposit balance")
		}
		newBalance := balance - amount
		if _, err := tx.ExecContext(ctx, `
			UPDATE "Customer" SET balance = $1 WHERE id = $2`, newBalance, customerID); err != nil {
			return nil, fmt.Errorf("deducting deposit: %w", err)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO "DepositTransaction" (id, "customerId", "branchId", type, amount, "balanceAfter", "orderId", notes, "createdAt")
			VALUES (gen_random_uuid()::text, $1, $2, 'DEDUCTION', $3, $4, $5, $6, NOW())`,
			customerID, branchID, amount, newBalance, id, notesArg); err != nil {
			return nil, fmt.Errorf("inserting deposit transaction: %w", err)
		}
	}

	newPaid := oldPaid + amount
	status := "PARTIAL"
	if newPaid >= total {
		status = "PAID"
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE "Order" SET "paidAmount" = $1, "paymentStatus" = $2, "updatedAt" = NOW() WHERE id = $3`,
		newPaid, status, id); err != nil {
		return nil, fmt.Errorf("updating order payment: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id, tenantID)
}

// VoidPayment reverses a recorded payment: deletes the Payment row + recomputes the order's
// paidAmount + paymentStatus. Used to correct mistaken/duplicate payment entries.
func (r *PgOrderRepository) VoidPayment(ctx context.Context, tenantID, orderID, paymentID string) (*domain.Order, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning tx: %w", err)
	}
	defer tx.Rollback()

	var total, paid float64
	var customerID, branchID string
	err = tx.QueryRowContext(ctx, `
		SELECT o."totalAmount"::float, o."paidAmount"::float, o."customerId", o."branchId"
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2 FOR UPDATE`, orderID, tenantID,
	).Scan(&total, &paid, &customerID, &branchID)
	if err != nil {
		return nil, fmt.Errorf("finding order for void: %w", err)
	}

	var amount float64
	var method string
	if err := tx.QueryRowContext(ctx,
		`SELECT amount::float, "paymentMethod" FROM "Payment" WHERE id = $1 AND "orderId" = $2`, paymentID, orderID,
	).Scan(&amount, &method); err != nil {
		return nil, fmt.Errorf("finding payment to void: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM "Payment" WHERE id = $1`, paymentID); err != nil {
		return nil, fmt.Errorf("deleting payment: %w", err)
	}

	// Refund the customer wallet if the voided payment was a DEPOSIT (RecordPayment deducted it).
	if method == "DEPOSIT" {
		if err := refundDeposit(ctx, tx, customerID, branchID, orderID, amount, "payment voided"); err != nil {
			return nil, err
		}
	}

	newPaid := paid - amount
	if newPaid < 0 {
		newPaid = 0
	}
	status := "PENDING"
	if newPaid >= total {
		status = "PAID"
	} else if newPaid > 0 {
		status = "PARTIAL"
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE "Order" SET "paidAmount" = $1, "paymentStatus" = $2, "updatedAt" = NOW() WHERE id = $3`,
		newPaid, status, orderID); err != nil {
		return nil, fmt.Errorf("updating order after void: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.FindByID(ctx, orderID, tenantID)
}
// recomputes the discount + total, and replaces the order's items.
func (r *PgOrderRepository) Update(ctx context.Context, id, tenantID string, in application.UpdateOrderInput) (*domain.Order, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning tx: %w", err)
	}
	defer tx.Rollback()

	var exists int
	if err := tx.QueryRowContext(ctx, `
		SELECT 1 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2`, id, tenantID,
	).Scan(&exists); err == sql.ErrNoRows {
		return nil, fmt.Errorf("order not found")
	} else if err != nil {
		return nil, fmt.Errorf("checking order: %w", err)
	}

	type priced struct {
		svcID           string
		qty, price, sub float64
		weight          *float64
		gb              json.RawMessage
	}
	// Batch-price all services in ONE query (avoids N+1 per-item lookups — mirrors Create).
	type svcPrice struct{ base float64; pt string }
	priceMap := map[string]svcPrice{}
	if len(in.Items) > 0 {
		ph := make([]string, len(in.Items))
		args := make([]interface{}, len(in.Items))
		for i, it := range in.Items {
			ph[i] = fmt.Sprintf("$%d", i+1)
			args[i] = it.ServiceID
		}
		prRows, prErr := tx.QueryContext(ctx, fmt.Sprintf(
			`SELECT id, "basePrice"::float, "pricingType" FROM "Service" WHERE id IN (%s)`,
			strings.Join(ph, ",")), args...)
		if prErr != nil {
			return nil, fmt.Errorf("pricing services: %w", prErr)
		}
		for prRows.Next() {
			var id, pt string
			var base float64
			if err := prRows.Scan(&id, &base, &pt); err != nil {
				prRows.Close()
				return nil, fmt.Errorf("scanning service price: %w", err)
			}
			priceMap[id] = svcPrice{base: base, pt: pt}
		}
		prRows.Close()
	}
	var items []priced
	gross := 0.0
	for _, it := range in.Items {
		sp, ok := priceMap[it.ServiceID]
		if !ok {
			return nil, fmt.Errorf("pricing service %s: not found", it.ServiceID)
		}
		sub := sp.base * effectiveQty(sp.pt, it.Quantity, it.WeightKg)
		gross += sub
		items = append(items, priced{it.ServiceID, it.Quantity, sp.base, sub, it.WeightKg, it.GarmentBreakdown})
	}
	discount := cappedDiscount(gross, in.DiscountType, in.DiscountAmount)
	total := gross - discount

	var recv any
	if in.ReceivedAt != nil && *in.ReceivedAt != "" {
		if t, perr := time.Parse(time.RFC3339, *in.ReceivedAt); perr == nil {
			recv = t
		}
	}
	if _, err := tx.ExecContext(ctx, `
		UPDATE "Order" SET "customerId" = $1, notes = $2, "receivedAt" = COALESCE($3, "receivedAt"),
			"discountType" = NULLIF($4, ''), "discountAmount" = $5, "totalAmount" = $6, "updatedAt" = NOW()
		WHERE id = $7`,
		in.CustomerID, in.Notes, recv, in.DiscountType, discount, total, id); err != nil {
		return nil, fmt.Errorf("updating order: %w", err)
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM "OrderItem" WHERE "orderId" = $1`, id); err != nil {
		return nil, fmt.Errorf("clearing items: %w", err)
	}
	for _, it := range items {
		var gbArg interface{}
		if len(it.gb) > 0 && string(it.gb) != "null" {
			gbArg = string(it.gb)
		}
		if _, err := tx.ExecContext(ctx, `
			INSERT INTO "OrderItem" (id, "orderId", "serviceId", quantity, "weightKg", "pricePerUnit", subtotal, "garmentBreakdown")
			VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7)`,
			id, it.svcID, it.qty, it.weight, it.price, it.sub, gbArg); err != nil {
			return nil, fmt.Errorf("inserting item: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	return r.FindByID(ctx, id, tenantID)
}
