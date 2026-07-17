package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/billing/domain"
)

type PgBillingRepository struct {
	db *sql.DB
}

func NewPgBillingRepository(db *sql.DB) *PgBillingRepository {
	return &PgBillingRepository{db: db}
}

// GetSubscriptionByTenant returns the tenant's subscription joined with its plan.
//
// Schema reality (prisma/schema.prisma):
//   - Plan has priceMonthly + priceYearly (NO single "price" column). We expose
//     priceMonthly as the headline Amount; yearly callers can extend later.
//   - Subscription has NO trialStart/trialEnd columns (trial is implicit via the
//     TRIAL status enum). Those fields stay nil on the domain aggregate.
func (r *PgBillingRepository) GetSubscriptionByTenant(ctx context.Context, tenantID string) (*domain.Subscription, error) {
	s := &domain.Subscription{}
	var (
		planName               sql.NullString
		amount                 sql.NullFloat64
		periodStart, periodEnd sql.NullTime
		trialEnd               sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT s.id, s."tenantId", s."planId", s.status,
		       p.name AS "planName",
		       p."priceMonthly"::float AS amount,
		       s."currentPeriodStart", s."currentPeriodEnd",
		       t."trialEndsAt"
		FROM "Subscription" s
		LEFT JOIN "Plan" p ON p.id = s."planId"
		LEFT JOIN "Tenant" t ON t.id = s."tenantId"
		WHERE s."tenantId" = $1`, tenantID,
	).Scan(
		&s.ID, &s.TenantID, &s.PlanID, &s.Status,
		&planName, &amount,
		&periodStart, &periodEnd,
		&trialEnd,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding subscription: %w", err)
	}
	s.PlanName = planName.String
	s.Amount = amount.Float64
	if periodStart.Valid {
		s.CurrentPeriodStart = &periodStart.Time
	}
	if periodEnd.Valid {
		s.CurrentPeriodEnd = &periodEnd.Time
	}
	if trialEnd.Valid {
		s.TrialEnd = &trialEnd.Time
	}
	return s, nil
}

// GetPlanByID returns a single billable plan.
//
// The Plan table stores priceMonthly + priceYearly (no single "price" column)
// and has no cadence/interval column. We expose priceMonthly as Price and
// default Interval to MONTHLY; checkout computes the real total from the chosen
// cadence when that becomes a product surface.
func (r *PgBillingRepository) GetPlanByID(ctx context.Context, planID string) (*domain.Plan, error) {
	p := &domain.Plan{Interval: domain.IntervalMonthly}
	var features []byte // Postgres stores features as JSON; we keep it raw here.
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, "priceMonthly"::float, features
		FROM "Plan" WHERE id = $1`, planID,
	).Scan(&p.ID, &p.Name, &p.Price, &features)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding plan: %w", err)
	}
	// We intentionally do not unmarshal features here — the Plan aggregate exposes
	// them only when callers need them (keeps the scan stable across JSON shapes).
	return p, nil
}

// GetPlanByTier resolves a Plan by its tier (FREE/GROWTH/PRO) — the dashboard checkout
// sends planTier, not planId.
func (r *PgBillingRepository) GetPlanByTier(ctx context.Context, tier string) (*domain.Plan, error) {
	p := &domain.Plan{Interval: domain.IntervalMonthly}
	var features []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, "priceMonthly"::float, features
		FROM "Plan" WHERE tier = $1 AND "isActive" = true`, tier,
	).Scan(&p.ID, &p.Name, &p.Price, &features)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding plan by tier: %w", err)
	}
	return p, nil
}

// CreatePayment inserts a new pending SaaSPayment row.
//
// SaaSPayment has no "subscriptionId"/"provider"/"providerOrderId" columns; the
// provider is fixed to Midtrans and the order id lives in "midtransOrderId".
// outletCount/unitPrice/monthsPurchased are required NOT NULL in the schema, so
// we seed sensible defaults (1 outlet, the plan price as unit price, 1 month) —
// the real checkout flow will overwrite these before the Snap request.
func (r *PgBillingRepository) CreatePayment(ctx context.Context, p *domain.SaaSPayment) error {
	outlets, months := p.OutletCount, p.MonthsPurchased
	if outlets < 1 {
		outlets = 1
	}
	if months < 1 {
		months = 1
	}
	unitPrice := p.UnitPrice
	if unitPrice <= 0 {
		unitPrice = p.Amount / float64(outlets*months) // best-effort fallback
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "SaaSPayment" ("tenantId", amount, "outletCount", "unitPrice", "monthsPurchased",
			"midtransOrderId", status, kind, "promoCodeId", "createdAt")
		VALUES ($1, $2, $3, $4, $5, $6, $7, 'INITIAL', $8, NOW()) RETURNING id, "createdAt"`,
		p.TenantID, p.Amount, outlets, unitPrice, months, p.ProviderOrderID, p.Status, p.PromoCodeID,
	).Scan(&p.ID, &p.CreatedAt)
}

// GetPaymentByOrderID looks up a payment by its Midtrans order id.
func (r *PgBillingRepository) GetPaymentByOrderID(ctx context.Context, orderID string) (*domain.SaaSPayment, error) {
	p := &domain.SaaSPayment{Provider: "MIDTRANS"}
	var pcID sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "tenantId", amount::float, "outletCount", "unitPrice"::float, "monthsPurchased",
		       status, "midtransOrderId", "promoCodeId", "createdAt"
		FROM "SaaSPayment" WHERE "midtransOrderId" = $1`, orderID,
	).Scan(&p.ID, &p.TenantID, &p.Amount, &p.OutletCount, &p.UnitPrice, &p.MonthsPurchased,
		&p.Status, &p.ProviderOrderID, &pcID, &p.CreatedAt)
	if pcID.Valid {
		p.PromoCodeID = &pcID.String
	}
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding payment: %w", err)
	}
	return p, nil
}

// UpdatePaymentStatus flips the status of a payment.
func (r *PgBillingRepository) UpdatePaymentStatus(ctx context.Context, id string, status domain.SaaSPaymentStatus) error {
	_, err := r.db.ExecContext(ctx, `UPDATE "SaaSPayment" SET status = $1 WHERE id = $2`, status, id)
	if err != nil {
		return fmt.Errorf("updating payment status: %w", err)
	}
	return nil
}

// ActivateSubscription marks the tenant's subscription ACTIVE and extends the billing period.
func (r *PgBillingRepository) ActivateSubscription(ctx context.Context, tenantID string, periodEnd time.Time) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE "Subscription"
		SET status = $1, "currentPeriodStart" = NOW(), "currentPeriodEnd" = $2
		WHERE "tenantId" = $3`,
		domain.StatusActive, periodEnd, tenantID)
	if err != nil {
		return fmt.Errorf("activating subscription: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		// No subscription row exists yet — ponytail: low — callers should create one
		// during checkout when subscriptions are first provisioned. For now we no-op
		// so a webhook for an unprovisioned tenant doesn't 500.
		return nil
	}
	return nil
}

// GetPromoByCode returns an active, non-expired promo by code.
//
// PromoCode column mapping (prisma/schema.prisma):
//
//	type            -> domain.DiscountType   (PromoType enum: PERCENTAGE | FIXED)
//	value           -> domain.DiscountValue
//	maxRedemptions  -> domain.MaxRedemptions (nullable; 0 = unlimited for the aggregate)
//	redemptionCount -> domain.UsedCount
//	isActive        -> domain.Active
func (r *PgBillingRepository) GetPromoByCode(ctx context.Context, code string) (*domain.PromoCode, error) {
	pc := &domain.PromoCode{}
	var (
		validUntil     sql.NullTime
		maxRedemptions sql.NullInt64
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT id, code, type::text, value::float,
		       "maxRedemptions", "redemptionCount", "validUntil", "isActive"
		FROM "PromoCode"
		WHERE code = $1 AND "isActive" = true AND ("validUntil" IS NULL OR "validUntil" >= NOW())`, code,
	).Scan(
		&pc.ID, &pc.Code, &pc.Type, &pc.Value,
		&maxRedemptions, &pc.UsedCount, &validUntil, &pc.Active,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding promo code: %w", err)
	}
	if maxRedemptions.Valid {
		pc.MaxRedemptions = int(maxRedemptions.Int64)
	}
	if validUntil.Valid {
		pc.ValidUntil = &validUntil.Time
	}
	return pc, nil
}

// RedeemPromo increments a promo's redemption count + records the redemption (enforces maxRedemptions
// over time). Best-effort — called once per payment→PAID transition (idempotency guard in the webhook).
func (r *PgBillingRepository) RedeemPromo(ctx context.Context, promoCodeID, tenantID string) error {
	if _, err := r.db.ExecContext(ctx, `UPDATE "PromoCode" SET "redemptionCount" = "redemptionCount" + 1 WHERE id = $1`, promoCodeID); err != nil {
		return fmt.Errorf("incrementing promo redemption: %w", err)
	}
	if _, err := r.db.ExecContext(ctx, `INSERT INTO "PromoRedemption" (id, "promoCodeId", "tenantId", "appliedAt") VALUES (gen_random_uuid()::text, $1, $2, NOW())`, promoCodeID, tenantID); err != nil {
		return fmt.Errorf("recording promo redemption: %w", err)
	}
	return nil
}

// GetOutlets fetches branches for the billing status response.
func (r *PgBillingRepository) GetOutlets(ctx context.Context, tenantID string) ([]*domain.BillingOutlet, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, "coverageEnd", "isFreeTier"
		FROM "Branch" WHERE "tenantId" = $1 ORDER BY name`, tenantID)
	if err != nil {
		return nil, fmt.Errorf("fetching outlets: %w", err)
	}
	defer rows.Close()

	var out []*domain.BillingOutlet
	for rows.Next() {
		o := &domain.BillingOutlet{Status: "FREE"}
		var coverageEnd sql.NullTime
		if err := rows.Scan(&o.ID, &o.Name, &coverageEnd, &o.IsFreeTier); err != nil {
			return nil, err
		}
		if coverageEnd.Valid {
			s := coverageEnd.Time.UTC().Format("2006-01-02T15:04:05.000Z")
			o.CoverageEnd = &s
		}
		out = append(out, o)
	}
	return out, nil
}

// GetTenantInfo fetches the tenant summary for the billing status response.
func (r *PgBillingRepository) GetTenantInfo(ctx context.Context, tenantID string) (*domain.BillingTenant, error) {
	t := &domain.BillingTenant{ActiveModules: []string{}}
	var activeModules []byte
	err := r.db.QueryRowContext(ctx,
		`SELECT name, slug, "ownerEmail", array_to_json("activeModules") FROM "Tenant" WHERE id = $1`,
		tenantID,
	).Scan(&t.Name, &t.Slug, &t.OwnerEmail, &activeModules)
	if err == sql.ErrNoRows {
		return &domain.BillingTenant{ActiveModules: []string{}}, nil
	}
	if err != nil {
		return nil, fmt.Errorf("fetching tenant info: %w", err)
	}
	if activeModules != nil {
		_ = json.Unmarshal(activeModules, &t.ActiveModules)
	}
	return t, nil
}
