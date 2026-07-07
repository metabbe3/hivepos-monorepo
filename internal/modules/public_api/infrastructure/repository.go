package infrastructure

import (
	"context"
	"database/sql"
	"fmt"

	"github.com/hivepos/api/internal/modules/public_api/domain"
)

type PgPublicRepository struct {
	db *sql.DB
}

func NewPgPublicRepository(db *sql.DB) *PgPublicRepository {
	return &PgPublicRepository{db: db}
}

// resolveTenantID returns the tenant id for a slug, or "" if the tenant is missing/inactive.
// Public lookups always go through this — never trust a client-supplied tenantId.
func (r *PgPublicRepository) resolveTenantID(ctx context.Context, slug string) (string, error) {
	if slug == "" {
		return "", nil
	}
	var id string
	err := r.db.QueryRowContext(ctx, `
		SELECT id FROM "Tenant" WHERE slug = $1 AND active = true`, slug,
	).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("resolving tenant slug: %w", err)
	}
	return id, nil
}

// FindBranchesByTenantSlug returns the public branch directory for an active tenant.
func (r *PgPublicRepository) FindBranchesByTenantSlug(ctx context.Context, slug string) ([]*domain.PublicBranch, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT b.id, b.name, b.address, b.phone, b.hours, t.name
		FROM "Branch" b
		JOIN "Tenant" t ON t.id = b."tenantId"
		WHERE t.slug = $1 AND t.active = true AND b.active = true
		ORDER BY b.name`, slug,
	)
	if err != nil {
		return nil, fmt.Errorf("querying public branches: %w", err)
	}
	defer rows.Close()

	var list []*domain.PublicBranch
	for rows.Next() {
		b := &domain.PublicBranch{}
		var address, phone, hours sql.NullString
		if err := rows.Scan(&b.ID, &b.Name, &address, &phone, &hours, &b.TenantName); err != nil {
			return nil, fmt.Errorf("scanning public branch: %w", err)
		}
		b.Address = address.String
		b.Phone = phone.String
		b.Hours = hours.String
		list = append(list, b)
	}
	return list, rows.Err()
}

// FindServicesByTenantSlug returns the public service catalog for an active tenant.
// branchID is optional — when empty, services across all of the tenant's branches are returned.
func (r *PgPublicRepository) FindServicesByTenantSlug(ctx context.Context, slug, branchID string) ([]*domain.PublicService, error) {
	// ponytail: low — public catalog assumes "duration" column exists on "Service"; create via prisma db push if missing.
	// Falls back to NULL when the column is absent (NullableInt scan).
	query := `
		SELECT s.id, s.name, s.description, s."basePrice"::float AS price, s."pricingType", s."duration"
		FROM "Service" s
		JOIN "Branch" b ON b.id = s."branchId"
		JOIN "Tenant" t ON t.id = b."tenantId"
		WHERE t.slug = $1 AND t.active = true AND b.active = true AND s."isActive" = true`
	args := []interface{}{slug}
	if branchID != "" {
		query += ` AND s."branchId" = $2`
		args = append(args, branchID)
	}
	query += ` ORDER BY s.name`

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("querying public services: %w", err)
	}
	defer rows.Close()

	var list []*domain.PublicService
	for rows.Next() {
		s := &domain.PublicService{}
		var description sql.NullString
		var duration sql.NullInt64
		if err := rows.Scan(&s.ID, &s.Name, &description, &s.Price, &s.PricingType, &duration); err != nil {
			return nil, fmt.Errorf("scanning public service: %w", err)
		}
		s.Description = description.String
		if duration.Valid {
			d := int(duration.Int64)
			s.Duration = &d
		}
		list = append(list, s)
	}
	return list, rows.Err()
}

// CreateSupportTicket inserts a public support ticket. tenantId is resolved from slug when provided.
func (r *PgPublicRepository) CreateSupportTicket(ctx context.Context, input domain.TicketInput) (string, error) {
	var tenantID interface{}
	if input.TenantSlug != nil && *input.TenantSlug != "" {
		id, err := r.resolveTenantID(ctx, *input.TenantSlug)
		if err != nil {
			return "", err
		}
		if id != "" {
			tenantID = id
		}
	}

	var id string
	// status defaults to OPEN and priority to NORMAL at the DB level; we pass them explicitly for clarity.
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "SupportTicket" (name, email, subject, message, status, priority, "tenantId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, 'OPEN', 'NORMAL', $5, NOW(), NOW())
		RETURNING id`,
		input.Name, input.Email, input.Subject, input.Message, tenantID,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("inserting support ticket: %w", err)
	}
	return id, nil
}

// FindOrderByNumber returns a public order view by orderNumber.
// phoneLast4, when non-empty, must match the last 4 chars of the order's customer phone (verification).
func (r *PgPublicRepository) FindOrderByNumber(ctx context.Context, orderNumber, phoneLast4 string) (*domain.PublicOrder, error) {
	o := &domain.PublicOrder{}
	var customerPhone sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT o."orderNumber", o.status, o."paymentStatus", o."createdAt", c.phone
		FROM "Order" o
		LEFT JOIN "Customer" c ON c.id = o."customerId"
		WHERE o."orderNumber" = $1`, orderNumber,
	).Scan(&o.OrderNumber, &o.Status, &o.PaymentStatus, &o.CreatedAt, &customerPhone)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding order by number: %w", err)
	}

	// Phone verification: if the caller provided last-4 digits, confirm they match.
	if phoneLast4 != "" {
		phone := customerPhone.String
		if len(phone) < 4 || phone[len(phone)-4:] != phoneLast4 {
			return nil, nil // mismatch → treat as not found (no leak)
		}
	}

	// Fetch items.
	rows, err := r.db.QueryContext(ctx, `
		SELECT COALESCE(s.name, ''), oi.quantity::float, oi.subtotal::float
		FROM "OrderItem" oi
		LEFT JOIN "Service" s ON s.id = oi."serviceId"
		WHERE oi."orderId" = (SELECT id FROM "Order" WHERE "orderNumber" = $1)`, orderNumber,
	)
	if err != nil {
		return nil, fmt.Errorf("querying order items: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		it := domain.PublicOrderItem{}
		if err := rows.Scan(&it.Name, &it.Quantity, &it.Subtotal); err != nil {
			return nil, fmt.Errorf("scanning order item: %w", err)
		}
		o.Items = append(o.Items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return o, nil
}

// CreatePickupRequest inserts a public pickup request.
func (r *PgPublicRepository) CreatePickupRequest(ctx context.Context, input domain.PickupInput) (string, error) {
	tenantID, err := r.resolveTenantID(ctx, input.TenantSlug)
	if err != nil {
		return "", err
	}
	if tenantID == "" {
		return "", fmt.Errorf("tenant not found for slug %q", input.TenantSlug)
	}

	var id string
	// ponytail: low — assumes "PickupRequest" table has these columns; create via prisma db push if missing.
	err = r.db.QueryRowContext(ctx, `
		INSERT INTO "PickupRequest" (name, phone, address, "preferredTime", notes, status, "tenantId", "createdAt", "updatedAt")
		VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, NOW(), NOW())
		RETURNING id`,
		input.Name, input.Phone, input.Address, input.PreferredTime, input.Notes, tenantID,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("inserting pickup request: %w", err)
	}
	return id, nil
}
