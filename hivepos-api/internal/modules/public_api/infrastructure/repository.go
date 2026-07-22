package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
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
		SELECT id FROM "Tenant" WHERE slug = $1 AND "isActive" = true`, slug,
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
		SELECT b.id, b.slug, b.name, b.address, b.phone, COALESCE(b."operatingHours"::text, ''),
		       b.latitude, b.longitude, b."whatsappLink", b."googleMapsLink", t.name
		FROM "Branch" b
		JOIN "Tenant" t ON t.id = b."tenantId"
		WHERE t.slug = $1 AND t."isActive" = true AND b."isActive" = true
		ORDER BY b.name`, slug,
	)
	if err != nil {
		return nil, fmt.Errorf("querying public branches: %w", err)
	}
	defer rows.Close()

	var list []*domain.PublicBranch
	for rows.Next() {
		b := &domain.PublicBranch{}
		var address, phone, whatsapp, maps sql.NullString
		var lat, lng sql.NullFloat64
		if err := rows.Scan(&b.ID, &b.Slug, &b.Name, &address, &phone, &b.OperatingHours, &lat, &lng, &whatsapp, &maps, &b.TenantName); err != nil {
			return nil, fmt.Errorf("scanning public branch: %w", err)
		}
		b.Address = address.String
		b.Phone = phone.String
		b.WhatsappLink = whatsapp.String
		b.GoogleMapsLink = maps.String
		if lat.Valid {
			v := lat.Float64
			b.Latitude = &v
		}
		if lng.Valid {
			v := lng.Float64
			b.Longitude = &v
		}
		list = append(list, b)
	}
	return list, rows.Err()
}

// FindServicesByTenantSlug returns the public service catalog for an active tenant.
// branchID is optional — when empty, services across all of the tenant's branches are returned.
func (r *PgPublicRepository) FindServicesByTenantSlug(ctx context.Context, slug, branchID string) ([]*domain.PublicService, error) {
	query := `
		SELECT s.id, s.name, s.description, s."basePrice"::float AS price, s."pricingType",
		       sg.id, sg.name
		FROM "Service" s
		JOIN "Branch" b ON b.id = s."branchId"
		JOIN "Tenant" t ON t.id = b."tenantId"
		LEFT JOIN "ServiceGroup" sg ON sg.id = s."groupId"
		WHERE t.slug = $1 AND t."isActive" = true AND b."isActive" = true AND s."isActive" = true`
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
		var sgID, sgName sql.NullString
		if err := rows.Scan(&s.ID, &s.Name, &description, &s.Price, &s.PricingType, &sgID, &sgName); err != nil {
			return nil, fmt.Errorf("scanning public service: %w", err)
		}
		s.Description = description.String
		if sgID.Valid {
			s.Group = &domain.PublicServiceGroup{ID: sgID.String, Name: sgName.String}
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
		INSERT INTO "SupportTicket" (id, name, email, subject, message, status, priority, "tenantId", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'OPEN', 'NORMAL', $5, NOW(), NOW())
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
	// Public pickup has no branch picker — assign to the tenant's first active branch
	// (PickupRequest.branchId is required). Map the FE payload onto the real columns:
	// name→customerName, phone→customerPhone, address→addressText, preferredTime→requestedSlot.
	var branchID string
	if err := r.db.QueryRowContext(ctx,
		`SELECT id FROM "Branch" WHERE "tenantId" = $1 AND "isActive" = true ORDER BY "createdAt" LIMIT 1`,
		tenantID,
	).Scan(&branchID); err != nil {
		return "", fmt.Errorf("no active branch for tenant: %w", err)
	}

	var slotArg, notesArg, emailArg, mapsArg interface{}
	if input.PreferredTime != "" {
		slotArg = input.PreferredTime
	}
	if input.Notes != "" {
		notesArg = input.Notes
	}
	if input.Email != "" {
		emailArg = input.Email
	}
	if input.MapsLink != "" {
		mapsArg = input.MapsLink
	}
	var latArg, lngArg interface{}
	if input.Latitude != nil {
		latArg = *input.Latitude
	}
	if input.Longitude != nil {
		lngArg = *input.Longitude
	}

	err = r.db.QueryRowContext(ctx, `
		INSERT INTO "PickupRequest" (id, "tenantId", "branchId", module, status, "customerName", "customerPhone",
			"customerEmail", "addressText", "mapsLink", latitude, longitude, "requestedSlot", notes, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'LAUNDRY', 'PENDING', $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
		RETURNING id`,
		tenantID, branchID, input.Name, input.Phone, emailArg, input.Address, mapsArg, latArg, lngArg, slotArg, notesArg,
	).Scan(&id)
	if err != nil {
		return "", fmt.Errorf("inserting pickup request: %w", err)
	}
	return id, nil
}

// FindPublicTenantBySlug loads the public website payload for an active tenant: identity +
// settings jsonb (carries the dashboard `website` block) + the full branch directory
// (geo/contact/links/hours) that the tenant-site renders.
func (r *PgPublicRepository) FindPublicTenantBySlug(ctx context.Context, slug string) (*domain.PublicTenant, error) {
	pt := &domain.PublicTenant{}
	var logoURL sql.NullString
	var settings []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, slug, "logoUrl", COALESCE(settings, '{}'::jsonb)
		FROM "Tenant"
		WHERE slug = $1 AND "isActive" = true`, slug,
	).Scan(&pt.ID, &pt.Name, &pt.Slug, &logoURL, &settings)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding public tenant: %w", err)
	}
	if logoURL.Valid {
		l := logoURL.String
		pt.LogoURL = &l
	}
	pt.Settings = json.RawMessage(settings)

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, address, phone, slug, latitude, longitude,
		       "googleMapsLink", "whatsappLink", COALESCE("operatingHours", '{}'::jsonb)
		FROM "Branch"
		WHERE "tenantId" = $1 AND "isActive" = true
		ORDER BY name`, pt.ID)
	if err != nil {
		return nil, fmt.Errorf("querying public tenant branches: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		b := domain.PublicTenantBranch{}
		var addr, ph, sl, gmaps, wa sql.NullString
		var lat, lng sql.NullFloat64
		var hours []byte
		if err := rows.Scan(&b.ID, &b.Name, &addr, &ph, &sl, &lat, &lng, &gmaps, &wa, &hours); err != nil {
			return nil, fmt.Errorf("scanning public tenant branch: %w", err)
		}
		if addr.Valid {
			b.Address = &addr.String
		}
		if ph.Valid {
			b.Phone = &ph.String
		}
		if sl.Valid {
			b.Slug = &sl.String
		}
		if gmaps.Valid {
			b.GoogleMapsLink = &gmaps.String
		}
		if wa.Valid {
			b.WhatsAppLink = &wa.String
		}
		if lat.Valid {
			b.Latitude = &lat.Float64
		}
		if lng.Valid {
			b.Longitude = &lng.Float64
		}
		b.OperatingHours = json.RawMessage(hours)
		pt.Branches = append(pt.Branches, b)
	}
	return pt, rows.Err()
}

const publicBlogPostColumns = `slug, title, description, keywords, content, "coverImage", "publishedAt"`

func scanPublicBlogPost(rows interface {
	Scan(dest ...interface{}) error
}) (*domain.PublicBlogPost, error) {
	p := &domain.PublicBlogPost{}
	var keywords, coverImage sql.NullString
	var publishedAt sql.NullTime
	if err := rows.Scan(&p.Slug, &p.Title, &p.Description, &keywords, &p.Content, &coverImage, &publishedAt); err != nil {
		return nil, err
	}
	if keywords.Valid {
		k := keywords.String
		p.Keywords = &k
	}
	if coverImage.Valid {
		c := coverImage.String
		p.CoverImage = &c
	}
	if publishedAt.Valid {
		t := publishedAt.Time
		p.PublishedAt = &t
	}
	return p, nil
}

// FindPublishedBlogPosts returns all published posts, newest first. For the public blog list + sitemap.
func (r *PgPublicRepository) FindPublishedBlogPosts(ctx context.Context) ([]*domain.PublicBlogPost, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+publicBlogPostColumns+`
		FROM "BlogPost"
		WHERE published = true
		ORDER BY "publishedAt" DESC NULLS LAST, "createdAt" DESC`)
	if err != nil {
		return nil, fmt.Errorf("querying published blog posts: %w", err)
	}
	defer rows.Close()

	var list []*domain.PublicBlogPost
	for rows.Next() {
		p, err := scanPublicBlogPost(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning published blog post: %w", err)
		}
		list = append(list, p)
	}
	return list, rows.Err()
}

// FindPublishedBlogPostBySlug returns a single published post by slug. nil → not found / unpublished.
func (r *PgPublicRepository) FindPublishedBlogPostBySlug(ctx context.Context, slug string) (*domain.PublicBlogPost, error) {
	row := r.db.QueryRowContext(ctx, `
		SELECT `+publicBlogPostColumns+`
		FROM "BlogPost"
		WHERE published = true AND slug = $1`, slug)
	p, err := scanPublicBlogPost(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding published blog post by slug: %w", err)
	}
	return p, nil
}
