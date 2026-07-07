package infrastructure

import (
	"context"
	"database/sql"
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
		planName                sql.NullString
		amount                  sql.NullFloat64
		periodStart, periodEnd  sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT s.id, s."tenantId", s."planId", s.status,
		       p.name AS "planName",
		       p."priceMonthly"::float AS amount,
		       s."currentPeriodStart", s."currentPeriodEnd"
		FROM "Subscription" s
		LEFT JOIN "Plan" p ON p.id = s."planId"
		WHERE s."tenantId" = $1`, tenantID,
	).Scan(
		&s.ID, &s.TenantID, &s.PlanID, &s.Status,
		&planName, &amount,
		&periodStart, &periodEnd,
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

// CreatePayment inserts a new pending SaaSPayment row.
//
// SaaSPayment has no "subscriptionId"/"provider"/"providerOrderId" columns; the
// provider is fixed to Midtrans and the order id lives in "midtransOrderId".
// outletCount/unitPrice/monthsPurchased are required NOT NULL in the schema, so
// we seed sensible defaults (1 outlet, the plan price as unit price, 1 month) —
// the real checkout flow will overwrite these before the Snap request.
func (r *PgBillingRepository) CreatePayment(ctx context.Context, p *domain.SaaSPayment) error {
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "SaaSPayment" ("tenantId", amount, "outletCount", "unitPrice", "monthsPurchased",
			"midtransOrderId", status, kind, "createdAt")
		VALUES ($1, $2, 1, $2, 1, $3, $4, 'INITIAL', NOW()) RETURNING id, "createdAt"`,
		p.TenantID, p.Amount, p.ProviderOrderID, p.Status,
	).Scan(&p.ID, &p.CreatedAt)
}

// GetPaymentByOrderID looks up a payment by its Midtrans order id.
func (r *PgBillingRepository) GetPaymentByOrderID(ctx context.Context, orderID string) (*domain.SaaSPayment, error) {
	p := &domain.SaaSPayment{Provider: "MIDTRANS"}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "tenantId", amount::float, status, "midtransOrderId", "createdAt"
		FROM "SaaSPayment" WHERE "midtransOrderId" = $1`, orderID,
	).Scan(&p.ID, &p.TenantID, &p.Amount, &p.Status, &p.ProviderOrderID, &p.CreatedAt)
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
//   type            -> domain.DiscountType   (PromoType enum: PERCENTAGE | FIXED)
//   value           -> domain.DiscountValue
//   maxRedemptions  -> domain.MaxRedemptions (nullable; 0 = unlimited for the aggregate)
//   redemptionCount -> domain.UsedCount
//   isActive        -> domain.Active
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
		&pc.ID, &pc.Code, &pc.DiscountType, &pc.DiscountValue,
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
