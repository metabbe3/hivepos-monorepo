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
func (r *PgBillingRepository) GetSubscriptionByTenant(ctx context.Context, tenantID string) (*domain.Subscription, error) {
	s := &domain.Subscription{}
	var (
		planName            sql.NullString
		amount              sql.NullFloat64
		trialStart, trialEnd sql.NullTime
		periodStart, periodEnd sql.NullTime
	)
	err := r.db.QueryRowContext(ctx, `
		SELECT s.id, s."tenantId", s."planId", s.status,
		       p.name AS "planName",
		       p.price::float AS amount,
		       s."trialStart", s."trialEnd",
		       s."currentPeriodStart", s."currentPeriodEnd"
		FROM "Subscription" s
		LEFT JOIN "Plan" p ON p.id = s."planId"
		WHERE s."tenantId" = $1`, tenantID,
	).Scan(
		&s.ID, &s.TenantID, &s.PlanID, &s.Status,
		&planName, &amount,
		&trialStart, &trialEnd,
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
	if trialStart.Valid {
		s.TrialStart = &trialStart.Time
	}
	if trialEnd.Valid {
		s.TrialEnd = &trialEnd.Time
	}
	if periodStart.Valid {
		s.CurrentPeriodStart = &periodStart.Time
	}
	if periodEnd.Valid {
		s.CurrentPeriodEnd = &periodEnd.Time
	}
	return s, nil
}

// GetPlanByID returns a single billable plan.
func (r *PgBillingRepository) GetPlanByID(ctx context.Context, planID string) (*domain.Plan, error) {
	p := &domain.Plan{}
	var features []byte // Postgres stores features as JSON; we keep it raw here.
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, price::float, interval, features
		FROM "Plan" WHERE id = $1`, planID,
	).Scan(&p.ID, &p.Name, &p.Price, &p.Interval, &features)
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
func (r *PgBillingRepository) CreatePayment(ctx context.Context, p *domain.SaaSPayment) error {
	var subscriptionID interface{}
	if p.SubscriptionID != "" {
		subscriptionID = p.SubscriptionID
	}
	return r.db.QueryRowContext(ctx, `
		INSERT INTO "SaaSPayment" ("subscriptionId", "tenantId", amount, status, provider, "providerOrderId", "createdAt")
		VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id, "createdAt"`,
		subscriptionID, p.TenantID, p.Amount, p.Status, p.Provider, p.ProviderOrderID,
	).Scan(&p.ID, &p.CreatedAt)
}

// GetPaymentByOrderID looks up a payment by its provider order id.
func (r *PgBillingRepository) GetPaymentByOrderID(ctx context.Context, orderID string) (*domain.SaaSPayment, error) {
	p := &domain.SaaSPayment{}
	var subscriptionID sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "subscriptionId", "tenantId", amount::float, status, provider, "providerOrderId", "createdAt"
		FROM "SaaSPayment" WHERE "providerOrderId" = $1`, orderID,
	).Scan(&p.ID, &subscriptionID, &p.TenantID, &p.Amount, &p.Status, &p.Provider, &p.ProviderOrderID, &p.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding payment: %w", err)
	}
	p.SubscriptionID = subscriptionID.String
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
func (r *PgBillingRepository) GetPromoByCode(ctx context.Context, code string) (*domain.PromoCode, error) {
	pc := &domain.PromoCode{}
	var validUntil sql.NullTime
	err := r.db.QueryRowContext(ctx, `
		SELECT id, code, "discountType", "discountValue"::float,
		       "maxRedemptions", "usedCount", "validUntil", active
		FROM "PromoCode"
		WHERE code = $1 AND active = true AND ("validUntil" IS NULL OR "validUntil" >= NOW())`, code,
	).Scan(
		&pc.ID, &pc.Code, &pc.DiscountType, &pc.DiscountValue,
		&pc.MaxRedemptions, &pc.UsedCount, &validUntil, &pc.Active,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding promo code: %w", err)
	}
	if validUntil.Valid {
		pc.ValidUntil = &validUntil.Time
	}
	return pc, nil
}
