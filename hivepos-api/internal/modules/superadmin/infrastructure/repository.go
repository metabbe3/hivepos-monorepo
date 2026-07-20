package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/hivepos/api/internal/auth"
	"github.com/hivepos/api/internal/modules/superadmin/application"
	"github.com/hivepos/api/internal/modules/superadmin/domain"
)

type PgSuperAdminRepository struct {
	db *sql.DB
}

func NewPgSuperAdminRepository(db *sql.DB) *PgSuperAdminRepository {
	return &PgSuperAdminRepository{db: db}
}

// ===================== STATS =====================

func (r *PgSuperAdminRepository) GetPlatformStats(ctx context.Context) (*domain.PlatformStats, error) {
	s := &domain.PlatformStats{}
	err := r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE "isActive" = true),
			COUNT(*) FILTER (WHERE "approvedAt" IS NULL),
			COUNT(*) FILTER (WHERE "trialEndsAt" IS NOT NULL AND "trialEndsAt" > NOW()),
			COUNT(*) FILTER (WHERE "createdAt" >= date_trunc('month', NOW()))
		FROM "Tenant"`).Scan(&s.TotalTenants, &s.ActiveTenants, &s.PendingTenants, &s.TrialTenants, &s.NewThisMonth)
	if err != nil {
		return nil, fmt.Errorf("platform stats: %w", err)
	}
	// Active users (scoped to active tenants)
	_ = r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM "User" u WHERE u."isActive" = true`).Scan(&s.ActiveUsers)
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "User"`).Scan(&s.TotalUsers)
	// MRR = sum of active subscription plan prices (rough)
	_ = r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(p."priceMonthly"), 0)::float
		FROM "Subscription" s JOIN "Plan" p ON p.id = s."planId"
		WHERE s.status = 'ACTIVE'`).Scan(&s.MRR)
	return s, nil
}

func (r *PgSuperAdminRepository) GetBillingOverview(ctx context.Context) (*domain.BillingOverview, error) {
	o := &domain.BillingOverview{}
	_ = r.db.QueryRowContext(ctx, `
		SELECT
			COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0)::float,
			COUNT(*) FILTER (WHERE status = 'PENDING'),
			COALESCE(SUM(amount) FILTER (WHERE status = 'REFUNDED'), 0)::float,
			COALESCE(SUM(amount) FILTER (WHERE status = 'PAID' AND "createdAt" >= date_trunc('month', NOW())), 0)::float,
			COUNT(DISTINCT "tenantId") FILTER (WHERE status = 'PAID'),
			COALESCE(SUM("outletCount") FILTER (WHERE status = 'PAID'), 0),
			COUNT(*) FILTER (WHERE status = 'FAILED' AND "createdAt" >= NOW() - INTERVAL '30 days')
		FROM "SaaSPayment"`).Scan(
		&o.TotalRevenue, &o.PendingPayments, &o.RefundedTotal, &o.PaidThisMonth,
		&o.PaidTenantCount, &o.ActivePaidOutlets, &o.FailedCount30d)
	o.MRR = o.TotalRevenue
	o.LifetimeGross = o.TotalRevenue
	return o, nil
}

// ===================== TENANTS =====================

func (r *PgSuperAdminRepository) ListTenants(ctx context.Context, filter application.ListFilter) ([]*domain.Tenant, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (name ILIKE $%d OR slug ILIKE $%d OR "ownerEmail" ILIKE $%d)`, idx, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}
	if filter.Status == "pending" {
		where += fmt.Sprintf(` AND "approvedAt" IS NULL`)
	} else if filter.Status == "active" {
		where += ` AND "isActive" = true AND "approvedAt" IS NOT NULL`
	} else if filter.Status == "suspended" {
		where += ` AND "isActive" = false`
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Tenant" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, name, slug, "ownerEmail", "ownerName", "ownerPhone", "logoUrl",
		       "customDomain", "isActive", "approvedAt", "isDemo", "trialEndsAt",
		       "onboardingCompletedAt", "createdAt", "updatedAt"
		FROM "Tenant" %s
		ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("listing tenants: %w", err)
	}
	defer rows.Close()

	var list []*domain.Tenant
	for rows.Next() {
		t := &domain.Tenant{}
		if err := rows.Scan(&t.ID, &t.Name, &t.Slug, &t.OwnerEmail, &t.OwnerName, &t.OwnerPhone, &t.LogoURL,
			&t.CustomDomain, &t.IsActive, &t.ApprovedAt, &t.IsDemo, &t.TrialEndsAt,
			&t.OnboardingCompletedAt, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, t)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) GetTenant(ctx context.Context, id string) (*domain.Tenant, error) {
	t := &domain.Tenant{}
	var activeModules []byte
	var settings sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, slug, "ownerEmail", "ownerName", "ownerPhone", "logoUrl",
		       "customDomain", "activeModules", settings, "isActive", "approvedAt",
		       "onboardingCompletedAt", "isDemo", "trialEndsAt", "trialTier",
		       "websiteEnabled", "websitePublishedAt", "referralCode", "createdAt", "updatedAt"
		FROM "Tenant" WHERE id = $1`, id,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.OwnerEmail, &t.OwnerName, &t.OwnerPhone, &t.LogoURL,
		&t.CustomDomain, &activeModules, &settings, &t.IsActive, &t.ApprovedAt,
		&t.OnboardingCompletedAt, &t.IsDemo, &t.TrialEndsAt, &t.TrialTier,
		&t.WebsiteEnabled, &t.WebsitePublishedAt, &t.ReferralCode, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if activeModules != nil {
		json.Unmarshal(activeModules, &t.ActiveModules)
	}
	if settings.Valid {
		t.Settings = json.RawMessage(settings.String)
	}
	return t, nil
}

func (r *PgSuperAdminRepository) UpdateTenant(ctx context.Context, id string, input application.TenantInput) (*domain.Tenant, error) {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Tenant" SET
			name = COALESCE($1, name),
			"ownerName" = COALESCE($2, "ownerName"),
			"ownerPhone" = COALESCE($3, "ownerPhone"),
			"ownerEmail" = COALESCE($4, "ownerEmail"),
			"logoUrl" = COALESCE($5, "logoUrl"),
			"isActive" = COALESCE($6, "isActive"),
			"updatedAt" = NOW()
		WHERE id = $7`,
		input.Name, input.OwnerName, input.OwnerPhone, input.OwnerEmail, input.LogoURL, input.IsActive, id)
	if err != nil {
		return nil, err
	}
	return r.GetTenant(ctx, id)
}

func (r *PgSuperAdminRepository) ApproveTenant(ctx context.Context, id string) (*domain.Tenant, error) {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Tenant"
		SET "approvedAt" = COALESCE("approvedAt", NOW()),
		    "trialEndsAt" = COALESCE("trialEndsAt", NOW() + interval '14 days'),
		    "isActive" = true, "updatedAt" = NOW()
		WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	return r.GetTenant(ctx, id)
}

func (r *PgSuperAdminRepository) SuspendTenant(ctx context.Context, id string, suspend bool) (*domain.Tenant, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE "Tenant" SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`, !suspend, id)
	if err != nil {
		return nil, err
	}
	return r.GetTenant(ctx, id)
}

// ToggleTenantWhatsApp sets settings.whatsappEnabled on the tenant row.
// Uses jsonb merge so other settings keys are preserved.
func (r *PgSuperAdminRepository) ToggleTenantWhatsApp(ctx context.Context, id string, enabled bool) error {
	val := "false"
	if enabled {
		val = "true"
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Tenant"
		SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('whatsappEnabled', `+val+`::bool),
		    "updatedAt" = NOW()
		WHERE id = $1`, id)
	return err
}

func (r *PgSuperAdminRepository) GetTenantBilling(ctx context.Context, id string) (interface{}, error) {
	var sub *domain.Subscription
	var payments []*SaaSPaymentRow

	subRow := r.db.QueryRowContext(ctx, `
		SELECT s.id, s."tenantId", s."planId", s.status, s."currentPeriodStart", s."currentPeriodEnd",
		       s."paidOutletCount", s."createdAt", s."updatedAt"
		FROM "Subscription" s WHERE s."tenantId" = $1`, id)
	s := &domain.Subscription{}
	err := subRow.Scan(&s.ID, &s.TenantID, &s.PlanID, &s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd,
		&s.PaidOutletCount, &s.CreatedAt, &s.UpdatedAt)
	if err == nil {
		sub = s
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT id, "tenantId", amount::float, "outletCount", "unitPrice"::float, "monthsPurchased",
		       kind, status, "midtransOrderId", "coverageStart", "coverageEnd", "createdAt", "paidAt"
		FROM "SaaSPayment" WHERE "tenantId" = $1 ORDER BY "createdAt" DESC LIMIT 50`, id)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			p := &SaaSPaymentRow{}
			rows.Scan(&p.ID, &p.TenantID, &p.Amount, &p.OutletCount, &p.UnitPrice, &p.MonthsPurchased,
				&p.Kind, &p.Status, &p.MidtransOrderID, &p.CoverageStart, &p.CoverageEnd, &p.CreatedAt, &p.PaidAt)
			payments = append(payments, p)
		}
	}
	return map[string]interface{}{"subscription": sub, "payments": payments}, nil
}

// SaaSPaymentRow is a local alias to avoid leaking float scans into the domain type.
type SaaSPaymentRow = domain.SaaSPayment

// GetTenantSubscription loads a tenant's subscription, or (nil, nil) if they have
// none. Tenants registered before subscription seeding (or via flows that skip it)
// have no row — callers must tolerate nil rather than 500.
func (r *PgSuperAdminRepository) GetTenantSubscription(ctx context.Context, id string) (*domain.Subscription, error) {
	s := &domain.Subscription{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, "tenantId", "planId", status, "currentPeriodStart", "currentPeriodEnd",
		       "paidOutletCount", "createdAt", "updatedAt"
		FROM "Subscription" WHERE "tenantId" = $1`, id,
	).Scan(&s.ID, &s.TenantID, &s.PlanID, &s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd,
		&s.PaidOutletCount, &s.CreatedAt, &s.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return s, nil
}

func (r *PgSuperAdminRepository) UpdateTenantSubscription(ctx context.Context, id string, input application.SubscriptionInput) (*domain.Subscription, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if input.Status != nil {
		_, err = tx.ExecContext(ctx, `UPDATE "Subscription" SET status = $1, "updatedAt" = NOW() WHERE "tenantId" = $2`, *input.Status, id)
	} else if input.PlanID != "" {
		// Upsert: tenants registered without a Subscription row (registration only
		// seeds Tenant+User+Branch) had no row to UPDATE — the plan change silently
		// no-op'd. INSERT on miss, UPDATE planId on conflict.
		_, err = tx.ExecContext(ctx, `
			INSERT INTO "Subscription" (id, "tenantId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "paidOutletCount", "createdAt", "updatedAt")
			VALUES (gen_random_uuid()::text, $1, $2, 'ACTIVE', NOW(), NOW() + interval '30 days', 0, NOW(), NOW())
			ON CONFLICT ("tenantId") DO UPDATE SET "planId" = EXCLUDED."planId", "updatedAt" = NOW()`, id, input.PlanID)
	} else {
		_, err = tx.ExecContext(ctx, `UPDATE "Subscription" SET "updatedAt" = NOW() WHERE "tenantId" = $1`, id)
	}
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	s := &domain.Subscription{}
	_ = r.db.QueryRowContext(ctx, `
		SELECT id, "tenantId", "planId", status, "currentPeriodStart", "currentPeriodEnd",
		       "paidOutletCount", "createdAt", "updatedAt"
		FROM "Subscription" WHERE "tenantId" = $1`, id,
	).Scan(&s.ID, &s.TenantID, &s.PlanID, &s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd,
		&s.PaidOutletCount, &s.CreatedAt, &s.UpdatedAt)
	return s, nil
}

// ExtendTrial extends a tenant's trial by `days`, bumping Subscription.currentPeriodEnd,
// Tenant.trialEndsAt, AND every Branch.coverageEnd in one transaction.
//
// Branch.coverageEnd is what /branches + /billing outlet cards read — it must move
// with the trial or those surfaces keep showing a stale expiry. The legacy
// extend_trial updated only Subscription + Tenant and left Branch.coverageEnd behind;
// this closes that gap.
//
// ponytail: no AuditLog row written — the Go super-admin module has no audit writer
// yet (only ListAuditLogs reads). Add an INSERT into "AuditLog" (action
// "subscription.extend_trial", actor from auth ctx) when a writer lands.
func (r *PgSuperAdminRepository) ExtendTrial(ctx context.Context, tenantID string, days int) (*domain.Subscription, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// Base = current currentPeriodEnd if set, else now.
	var base sql.NullTime
	_ = tx.QueryRowContext(ctx, `SELECT "currentPeriodEnd" FROM "Subscription" WHERE "tenantId" = $1`, tenantID).Scan(&base)
	next := time.Now()
	if base.Valid {
		next = base.Time
	}
	next = next.AddDate(0, 0, days)

	if _, err = tx.ExecContext(ctx, `UPDATE "Subscription" SET status = 'TRIAL', "currentPeriodEnd" = $1, "updatedAt" = NOW() WHERE "tenantId" = $2`, next, tenantID); err != nil {
		return nil, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE "Tenant" SET "trialEndsAt" = $1, "updatedAt" = NOW() WHERE id = $2`, next, tenantID); err != nil {
		return nil, err
	}
	if _, err = tx.ExecContext(ctx, `UPDATE "Branch" SET "coverageEnd" = $1, "updatedAt" = NOW() WHERE "tenantId" = $2`, next, tenantID); err != nil {
		return nil, err
	}
	if err = tx.Commit(); err != nil {
		return nil, err
	}

	id := tenantID
	s := &domain.Subscription{}
	_ = r.db.QueryRowContext(ctx, `
		SELECT id, "tenantId", "planId", status, "currentPeriodStart", "currentPeriodEnd",
		       "paidOutletCount", "createdAt", "updatedAt"
		FROM "Subscription" WHERE "tenantId" = $1`, id,
	).Scan(&s.ID, &s.TenantID, &s.PlanID, &s.Status, &s.CurrentPeriodStart, &s.CurrentPeriodEnd,
		&s.PaidOutletCount, &s.CreatedAt, &s.UpdatedAt)
	return s, nil
}

// ===================== USERS =====================

func (r *PgSuperAdminRepository) ListUsers(ctx context.Context, filter application.ListFilter) ([]*domain.User, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (email ILIKE $%d OR name ILIKE $%d)`, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "User" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, email, name, phone, role, "roleId", "tenantId", "branchId", "isActive",
		       "emailVerified", "lastLoginAt", "createdAt", "updatedAt"
		FROM "User" %s ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.User
	for rows.Next() {
		u := &domain.User{}
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Phone, &u.Role, &u.RoleID, &u.TenantID, &u.BranchID,
			&u.IsActive, &u.EmailVerified, &u.LastLoginAt, &u.CreatedAt, &u.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, u)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) SuspendUser(ctx context.Context, id string, suspend bool) (*domain.User, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE "User" SET "isActive" = $1, "updatedAt" = NOW() WHERE id = $2`, !suspend, id)
	if err != nil {
		return nil, err
	}
	u := &domain.User{}
	_ = r.db.QueryRowContext(ctx, `SELECT id, email, name, phone, role, "roleId", "tenantId", "branchId", "isActive", "createdAt", "updatedAt" FROM "User" WHERE id = $1`, id).
		Scan(&u.ID, &u.Email, &u.Name, &u.Phone, &u.Role, &u.RoleID, &u.TenantID, &u.BranchID, &u.IsActive, &u.CreatedAt, &u.UpdatedAt)
	return u, nil
}

func (r *PgSuperAdminRepository) ResetUserPassword(ctx context.Context, id string) (string, error) {
	// ponytail: 5 — generate random temp password instead of proper crypto-random token.
	temp := fmt.Sprintf("reset-%d", time.Now().UnixNano())
	// Real implementation would hash + email; here we just return a placeholder.
	return temp, nil
}

// ===================== PAYMENTS =====================

func (r *PgSuperAdminRepository) ListPayments(ctx context.Context, filter application.ListFilter) ([]*domain.SaaSPayment, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Status != "" {
		where += fmt.Sprintf(` AND status = $%d`, idx)
		args = append(args, filter.Status)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND "midtransOrderId" ILIKE $%d`, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "SaaSPayment" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT p.id, p."tenantId", COALESCE(t.name, ''), p.amount::float, p."outletCount", p."unitPrice"::float, p."monthsPurchased",
		       p.kind, p.status, p."midtransOrderId", p."coverageStart", p."coverageEnd", p."createdAt", p."paidAt"
		FROM "SaaSPayment" p LEFT JOIN "Tenant" t ON t.id = p."tenantId" %s ORDER BY p."createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.SaaSPayment
	for rows.Next() {
		p := &domain.SaaSPayment{}
		if err := rows.Scan(&p.ID, &p.TenantID, &p.TenantName, &p.Amount, &p.OutletCount, &p.UnitPrice, &p.MonthsPurchased,
			&p.Kind, &p.Status, &p.MidtransOrderID, &p.CoverageStart, &p.CoverageEnd, &p.CreatedAt, &p.PaidAt); err != nil {
			return nil, 0, err
		}
		list = append(list, p)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) RefundPayment(ctx context.Context, id string) (*domain.SaaSPayment, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE "SaaSPayment" SET status = 'REFUNDED' WHERE id = $1 AND status = 'PAID'`, id)
	if err != nil {
		return nil, err
	}
	p := &domain.SaaSPayment{}
	_ = r.db.QueryRowContext(ctx, `SELECT id, "tenantId", amount::float, "outletCount", "unitPrice"::float, "monthsPurchased", kind, status, "createdAt", "paidAt" FROM "SaaSPayment" WHERE id = $1`, id).
		Scan(&p.ID, &p.TenantID, &p.Amount, &p.OutletCount, &p.UnitPrice, &p.MonthsPurchased, &p.Kind, &p.Status, &p.CreatedAt, &p.PaidAt)
	return p, nil
}

// ===================== PLANS =====================

func (r *PgSuperAdminRepository) ListPlans(ctx context.Context) ([]*domain.Plan, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, name, description, "maxOutlets", "maxUsers", "maxOrders",
		       "priceMonthly"::float, "priceYearly"::float, "isActive", tier, "createdAt", "updatedAt"
		FROM "Plan" ORDER BY "priceMonthly" ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*domain.Plan
	for rows.Next() {
		p := &domain.Plan{}
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.MaxOutlets, &p.MaxUsers, &p.MaxOrders,
			&p.PriceMonthly, &p.PriceYearly, &p.IsActive, &p.Tier, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, p)
	}
	return list, nil
}

func (r *PgSuperAdminRepository) CreatePlan(ctx context.Context, input application.PlanInput) (*domain.Plan, error) {
	name := ""
	if input.Name != nil {
		name = *input.Name
	}
	maxOutlets := 1
	if input.MaxOutlets != nil {
		maxOutlets = *input.MaxOutlets
	}
	maxUsers := 2
	if input.MaxUsers != nil {
		maxUsers = *input.MaxUsers
	}
	maxOrders := 100
	if input.MaxOrders != nil {
		maxOrders = *input.MaxOrders
	}
	priceMonthly := 0.0
	if input.PriceMonthly != nil {
		priceMonthly = *input.PriceMonthly
	}
	priceYearly := 0.0
	if input.PriceYearly != nil {
		priceYearly = *input.PriceYearly
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	p := &domain.Plan{}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "Plan" (id, name, description, "maxOutlets", "maxUsers", "maxOrders", "priceMonthly", "priceYearly", "isActive", tier, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, "createdAt", "updatedAt"`,
		name, input.Description, maxOutlets, maxUsers, maxOrders, priceMonthly, priceYearly, isActive, input.Tier,
	).Scan(&p.ID, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, err
	}
	p.Name = name
	p.Description = input.Description
	p.MaxOutlets = maxOutlets
	p.MaxUsers = maxUsers
	p.MaxOrders = maxOrders
	p.PriceMonthly = priceMonthly
	p.PriceYearly = priceYearly
	p.IsActive = isActive
	p.Tier = input.Tier
	return p, nil
}

func (r *PgSuperAdminRepository) UpdatePlan(ctx context.Context, id string, input application.PlanInput) (*domain.Plan, error) {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "Plan" SET
			name = COALESCE($1, name),
			description = COALESCE($2, description),
			"maxOutlets" = COALESCE($3, "maxOutlets"),
			"maxUsers" = COALESCE($4, "maxUsers"),
			"maxOrders" = COALESCE($5, "maxOrders"),
			"priceMonthly" = COALESCE($6, "priceMonthly"),
			"priceYearly" = COALESCE($7, "priceYearly"),
			"isActive" = COALESCE($8, "isActive"),
			tier = COALESCE($9, tier),
			"updatedAt" = NOW()
		WHERE id = $10`,
		input.Name, input.Description, input.MaxOutlets, input.MaxUsers, input.MaxOrders,
		input.PriceMonthly, input.PriceYearly, input.IsActive, input.Tier, id)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.QueryContext(ctx, `SELECT id, name, description, "maxOutlets", "maxUsers", "maxOrders", "priceMonthly"::float, "priceYearly"::float, "isActive", tier, "createdAt", "updatedAt" FROM "Plan" WHERE id = $1`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	if rows.Next() {
		p := &domain.Plan{}
		rows.Scan(&p.ID, &p.Name, &p.Description, &p.MaxOutlets, &p.MaxUsers, &p.MaxOrders, &p.PriceMonthly, &p.PriceYearly, &p.IsActive, &p.Tier, &p.CreatedAt, &p.UpdatedAt)
		return p, nil
	}
	return &domain.Plan{ID: id}, nil
}

func (r *PgSuperAdminRepository) DeletePlan(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "Plan" WHERE id = $1`, id)
	return err
}

// ===================== PROMO CODES =====================

func (r *PgSuperAdminRepository) ListPromoCodes(ctx context.Context, filter application.ListFilter) ([]*domain.PromoCode, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Search != "" {
		where += fmt.Sprintf(` AND code ILIKE $%d`, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}
	if filter.Status == "active" {
		where += ` AND "isActive" = true`
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "PromoCode" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, code, description, type, value::float, "maxRedemptions", "redemptionCount",
		       "validFrom", "validUntil", "isActive", "applicablePlan", "createdAt"
		FROM "PromoCode" %s ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.PromoCode
	for rows.Next() {
		p := &domain.PromoCode{}
		if err := rows.Scan(&p.ID, &p.Code, &p.Description, &p.Type, &p.Value, &p.MaxRedemptions, &p.RedemptionCount,
			&p.ValidFrom, &p.ValidUntil, &p.IsActive, &p.ApplicablePlan, &p.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, p)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) CreatePromoCode(ctx context.Context, input application.PromoCodeInput) (*domain.PromoCode, error) {
	code := ""
	if input.Code != nil {
		code = *input.Code
	}
	pType := "DISCOUNT_PERCENT"
	if input.Type != nil {
		pType = *input.Type
	}
	value := 0.0
	if input.Value != nil {
		value = *input.Value
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	p := &domain.PromoCode{}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "PromoCode" (id, code, description, type, value, "maxRedemptions", "validFrom", "validUntil", "isActive", "applicablePlan", "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
		RETURNING id, "createdAt"`,
		code, input.Description, pType, value, input.MaxRedemptions, input.ValidFrom, input.ValidUntil, isActive, input.ApplicablePlan,
	).Scan(&p.ID, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	p.Code = code
	p.Description = input.Description
	p.Type = pType
	p.Value = value
	p.MaxRedemptions = input.MaxRedemptions
	p.ValidFrom = input.ValidFrom
	p.ValidUntil = input.ValidUntil
	p.IsActive = isActive
	p.ApplicablePlan = input.ApplicablePlan
	return p, nil
}

func (r *PgSuperAdminRepository) UpdatePromoCode(ctx context.Context, id string, input application.PromoCodeInput) (*domain.PromoCode, error) {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "PromoCode" SET
			code = COALESCE($1, code),
			description = COALESCE($2, description),
			type = COALESCE($3, type),
			value = COALESCE($4, value),
			"maxRedemptions" = COALESCE($5, "maxRedemptions"),
			"validFrom" = COALESCE($6, "validFrom"),
			"validUntil" = COALESCE($7, "validUntil"),
			"isActive" = COALESCE($8, "isActive"),
			"applicablePlan" = COALESCE($9, "applicablePlan")
		WHERE id = $10`,
		input.Code, input.Description, input.Type, input.Value, input.MaxRedemptions,
		input.ValidFrom, input.ValidUntil, input.IsActive, input.ApplicablePlan, id)
	if err != nil {
		return nil, err
	}
	p := &domain.PromoCode{}
	_ = r.db.QueryRowContext(ctx, `SELECT id, code, description, type, value::float, "maxRedemptions", "redemptionCount", "validFrom", "validUntil", "isActive", "applicablePlan", "createdAt" FROM "PromoCode" WHERE id = $1`, id).
		Scan(&p.ID, &p.Code, &p.Description, &p.Type, &p.Value, &p.MaxRedemptions, &p.RedemptionCount, &p.ValidFrom, &p.ValidUntil, &p.IsActive, &p.ApplicablePlan, &p.CreatedAt)
	return p, nil
}

func (r *PgSuperAdminRepository) DeletePromoCode(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "PromoCode" WHERE id = $1`, id)
	return err
}

// ===================== FEATURE FLAGS =====================

func (r *PgSuperAdminRepository) ListFeatureFlags(ctx context.Context) ([]*domain.FeatureFlag, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id, key, name, description, enabled, category, "createdAt", "updatedAt" FROM "FeatureFlag" ORDER BY category, key`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*domain.FeatureFlag
	for rows.Next() {
		f := &domain.FeatureFlag{}
		if err := rows.Scan(&f.ID, &f.Key, &f.Name, &f.Description, &f.Enabled, &f.Category, &f.CreatedAt, &f.UpdatedAt); err != nil {
			return nil, err
		}
		list = append(list, f)
	}
	return list, nil
}

// GetFeatureFlag loads a single flag by id (for the detail page).
func (r *PgSuperAdminRepository) GetFeatureFlag(ctx context.Context, id string) (*domain.FeatureFlag, error) {
	f := &domain.FeatureFlag{}
	err := r.db.QueryRowContext(ctx, `SELECT id, key, name, description, enabled, category, "createdAt", "updatedAt" FROM "FeatureFlag" WHERE id = $1`, id).
		Scan(&f.ID, &f.Key, &f.Name, &f.Description, &f.Enabled, &f.Category, &f.CreatedAt, &f.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return f, nil
}

func (r *PgSuperAdminRepository) CreateFeatureFlag(ctx context.Context, input application.FeatureFlagInput) (*domain.FeatureFlag, error) {
	key := ""
	if input.Key != nil {
		key = *input.Key
	}
	name := ""
	if input.Name != nil {
		name = *input.Name
	}
	enabled := true
	if input.Enabled != nil {
		enabled = *input.Enabled
	}
	category := "general"
	if input.Category != nil {
		category = *input.Category
	}
	f := &domain.FeatureFlag{}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "FeatureFlag" (id, key, name, description, enabled, category, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id, "createdAt", "updatedAt"`,
		key, name, input.Description, enabled, category,
	).Scan(&f.ID, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, err
	}
	f.Key = key
	f.Name = name
	f.Description = input.Description
	f.Enabled = enabled
	f.Category = category
	return f, nil
}

func (r *PgSuperAdminRepository) UpdateFeatureFlag(ctx context.Context, id string, input application.FeatureFlagInput) (*domain.FeatureFlag, error) {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "FeatureFlag" SET
			key = COALESCE($1, key),
			name = COALESCE($2, name),
			description = COALESCE($3, description),
			enabled = COALESCE($4, enabled),
			category = COALESCE($5, category),
			"updatedAt" = NOW()
		WHERE id = $6`,
		input.Key, input.Name, input.Description, input.Enabled, input.Category, id)
	if err != nil {
		return nil, err
	}
	f := &domain.FeatureFlag{}
	_ = r.db.QueryRowContext(ctx, `SELECT id, key, name, description, enabled, category, "createdAt", "updatedAt" FROM "FeatureFlag" WHERE id = $1`, id).
		Scan(&f.ID, &f.Key, &f.Name, &f.Description, &f.Enabled, &f.Category, &f.CreatedAt, &f.UpdatedAt)
	return f, nil
}

func (r *PgSuperAdminRepository) DeleteFeatureFlag(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "FeatureFlag" WHERE id = $1`, id)
	return err
}

func (r *PgSuperAdminRepository) ListTenantFlags(ctx context.Context, flagID string) ([]*domain.TenantFeatureFlag, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT tf.id, tf."flagId", tf."tenantId", tf.enabled, tf.reason, tf."createdAt", tf."updatedAt",
		       t.name AS "tenantName", t.slug AS "tenantSlug", f.key AS "flagKey"
		FROM "TenantFeatureFlag" tf
		JOIN "Tenant" t ON t.id = tf."tenantId"
		JOIN "FeatureFlag" f ON f.id = tf."flagId"
		WHERE tf."flagId" = $1`, flagID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []*domain.TenantFeatureFlag
	for rows.Next() {
		tf := &domain.TenantFeatureFlag{}
		if err := rows.Scan(&tf.ID, &tf.FlagID, &tf.TenantID, &tf.Enabled, &tf.Reason, &tf.CreatedAt, &tf.UpdatedAt, &tf.Tenant, &tf.TenantSlug, &tf.FlagKey); err != nil {
			return nil, err
		}
		list = append(list, tf)
	}
	return list, nil
}

// ListAllTenantFlags returns ALL tenants with their override status for a flag.
// LEFT JOIN Tenant → TenantFeatureFlag so tenants without overrides appear too.
// Response shape matches FE TenantRow: {tenantId, tenantName, tenantSlug,
// overrideEnabled: null|bool, reason, effective}.
func (r *PgSuperAdminRepository) ListAllTenantFlags(ctx context.Context, flagID, search string, overrideOnly bool) ([]map[string]any, error) {
	args := []interface{}{flagID}
	idx := 2
	where := ""
	if search != "" {
		where += fmt.Sprintf(` AND t.name ILIKE $%d`, idx)
		args = append(args, "%"+search+"%")
		idx++
	}
	if overrideOnly {
		where += ` AND tf.id IS NOT NULL`
	}

	rows, err := r.db.QueryContext(ctx, fmt.Sprintf(`
		SELECT t.id, t.name, t.slug,
		       tf.id, tf.enabled, tf.reason,
		       f.enabled
		FROM "Tenant" t
		LEFT JOIN "TenantFeatureFlag" tf ON tf."tenantId" = t.id AND tf."flagId" = $1
		LEFT JOIN "FeatureFlag" f ON f.id = $1
		WHERE 1=1%s
		ORDER BY t.name
		LIMIT 50`, where), args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var list []map[string]any
	for rows.Next() {
		var tenantID, tenantName, tenantSlug string
		var overrideID sql.NullString
		var overrideEnabled, globalDefault sql.NullBool
		var overrideReason sql.NullString
		if err := rows.Scan(&tenantID, &tenantName, &tenantSlug, &overrideID, &overrideEnabled, &overrideReason, &globalDefault); err != nil {
			return nil, err
		}

		// FE expects overrideEnabled as null (no override) or bool (override set).
		var overrideVal any // nil by default
		var reasonVal any
		if overrideID.Valid {
			overrideVal = overrideEnabled.Bool
		}
		if overrideReason.Valid {
			reasonVal = overrideReason.String
		}

		// Effective = override value if set, else global default.
		effective := false
		if globalDefault.Valid {
			effective = globalDefault.Bool
		}
		if overrideID.Valid {
			effective = overrideEnabled.Bool
		}

		list = append(list, map[string]any{
			"tenantId":        tenantID,
			"tenantName":      tenantName,
			"tenantSlug":      tenantSlug,
			"overrideEnabled": overrideVal,
			"reason":          reasonVal,
			"effective":       effective,
		})
	}
	return list, nil
}

func (r *PgSuperAdminRepository) UpsertTenantFlag(ctx context.Context, flagID string, input application.TenantFlagInput) (*domain.TenantFeatureFlag, error) {
	tf := &domain.TenantFeatureFlag{FlagID: flagID, TenantID: input.TenantID, Enabled: input.Enabled}
	var reasonVal interface{}
	if input.Reason != "" {
		reasonVal = input.Reason
	}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "TenantFeatureFlag" (id, "flagId", "tenantId", enabled, reason, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW())
		ON CONFLICT ("flagId", "tenantId") DO UPDATE SET enabled = EXCLUDED.enabled, reason = EXCLUDED.reason, "updatedAt" = NOW()
		RETURNING id, "createdAt", "updatedAt"`,
		flagID, input.TenantID, input.Enabled, reasonVal,
	).Scan(&tf.ID, &tf.CreatedAt, &tf.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return tf, nil
}

func (r *PgSuperAdminRepository) DeleteTenantFlag(ctx context.Context, flagID, tenantID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "TenantFeatureFlag" WHERE "flagId" = $1 AND "tenantId" = $2`, flagID, tenantID)
	return err
}

// ===================== REFERRALS =====================

func (r *PgSuperAdminRepository) ListReferrals(ctx context.Context, filter application.ListFilter) ([]*domain.Referral, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Status != "" {
		where += fmt.Sprintf(` AND r.status = $%d`, idx)
		args = append(args, filter.Status)
		idx++
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "Referral" r `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT r.id, r."referrerId", r."referredId", r.status, r."rewardMonths", r.reason, r."createdAt", r."rewardedAt",
		       ref.name AS "referrerName", rec.name AS "referredName"
		FROM "Referral" r
		LEFT JOIN "Tenant" ref ON ref.id = r."referrerId"
		LEFT JOIN "Tenant" rec ON rec.id = r."referredId"
		%s ORDER BY r."createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.Referral
	for rows.Next() {
		ref := &domain.Referral{}
		if err := rows.Scan(&ref.ID, &ref.ReferrerID, &ref.ReferredID, &ref.Status, &ref.RewardMonths, &ref.Reason,
			&ref.CreatedAt, &ref.RewardedAt, &ref.ReferrerName, &ref.ReferredName); err != nil {
			return nil, 0, err
		}
		list = append(list, ref)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) UpdateReferral(ctx context.Context, id, status, reason string) (*domain.Referral, error) {
	var reasonVal interface{}
	if reason != "" {
		reasonVal = reason
	}
	rewardedAt := "NULL"
	if status == "REWARDED" {
		rewardedAt = "NOW()"
	}
	_, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE "Referral" SET status = $1, reason = $2, "rewardedAt" = %s WHERE id = $3`, rewardedAt),
		status, reasonVal, id)
	if err != nil {
		return nil, err
	}
	ref := &domain.Referral{}
	_ = r.db.QueryRowContext(ctx, `SELECT id, "referrerId", "referredId", status, "rewardMonths", reason, "createdAt", "rewardedAt" FROM "Referral" WHERE id = $1`, id).
		Scan(&ref.ID, &ref.ReferrerID, &ref.ReferredID, &ref.Status, &ref.RewardMonths, &ref.Reason, &ref.CreatedAt, &ref.RewardedAt)
	return ref, nil
}

// ===================== TICKETS =====================

func (r *PgSuperAdminRepository) ListTickets(ctx context.Context, filter application.ListFilter) ([]*domain.SupportTicket, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Status != "" {
		where += fmt.Sprintf(` AND status = $%d`, idx)
		args = append(args, filter.Status)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (subject ILIKE $%d OR "submitterEmail" ILIKE $%d)`, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "SupportTicket" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, subject, description, category, priority, status, "tenantId",
		       "submitterName", "submitterEmail", "submitterPhone", "csatRating", "csatComment",
		       "createdAt", "updatedAt", "resolvedAt"
		FROM "SupportTicket" %s ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.SupportTicket
	for rows.Next() {
		t := &domain.SupportTicket{}
		if err := rows.Scan(&t.ID, &t.Subject, &t.Description, &t.Category, &t.Priority, &t.Status, &t.TenantID,
			&t.SubmitterName, &t.SubmitterEmail, &t.SubmitterPhone, &t.CsatRating, &t.CsatComment,
			&t.CreatedAt, &t.UpdatedAt, &t.ResolvedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, t)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) GetTicket(ctx context.Context, id string) (*domain.SupportTicket, error) {
	t := &domain.SupportTicket{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, subject, description, category, priority, status, "tenantId",
		       "submitterName", "submitterEmail", "submitterPhone", "csatRating", "csatComment",
		       "createdAt", "updatedAt", "resolvedAt"
		FROM "SupportTicket" WHERE id = $1`, id,
	).Scan(&t.ID, &t.Subject, &t.Description, &t.Category, &t.Priority, &t.Status, &t.TenantID,
		&t.SubmitterName, &t.SubmitterEmail, &t.SubmitterPhone, &t.CsatRating, &t.CsatComment,
		&t.CreatedAt, &t.UpdatedAt, &t.ResolvedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return t, nil
}

func (r *PgSuperAdminRepository) AddTicketComment(ctx context.Context, ticketID, body, authorID, authorEmail string) (*domain.TicketComment, error) {
	// Fetch author name from SuperAdmin table.
	var authorName string
	_ = r.db.QueryRowContext(ctx, `SELECT name FROM "SuperAdmin" WHERE id = $1`, authorID).Scan(&authorName)
	if authorName == "" {
		authorName = authorEmail
	}
	c := &domain.TicketComment{TicketID: ticketID, AuthorName: authorName, AuthorEmail: authorEmail, AuthorRole: "SUPER_ADMIN", Body: body}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "TicketComment" (id, "ticketId", "authorName", "authorEmail", "authorRole", body, "createdAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW()) RETURNING id, "createdAt"`,
		ticketID, authorName, authorEmail, "SUPER_ADMIN", body,
	).Scan(&c.ID, &c.CreatedAt)
	if err != nil {
		return nil, err
	}
	// Bump ticket updatedAt
	_, _ = r.db.ExecContext(ctx, `UPDATE "SupportTicket" SET "updatedAt" = NOW() WHERE id = $1`, ticketID)
	return c, nil
}

// ListTicketComments returns the thread for a ticket (oldest first).
func (r *PgSuperAdminRepository) ListTicketComments(ctx context.Context, ticketID string) ([]*domain.TicketComment, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, "ticketId", COALESCE("authorName",''), COALESCE("authorEmail",''), COALESCE("authorRole",'TENANT_USER'), body, "createdAt"
		FROM "TicketComment" WHERE "ticketId" = $1 ORDER BY "createdAt" ASC`, ticketID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*domain.TicketComment
	for rows.Next() {
		c := &domain.TicketComment{}
		if err := rows.Scan(&c.ID, &c.TicketID, &c.AuthorName, &c.AuthorEmail, &c.AuthorRole, &c.Body, &c.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *PgSuperAdminRepository) UpdateTicketStatus(ctx context.Context, id, status string) (*domain.SupportTicket, error) {
	resolvedAt := "NULL"
	if status == "RESOLVED" || status == "CLOSED" {
		resolvedAt = "NOW()"
	}
	_, err := r.db.ExecContext(ctx, fmt.Sprintf(`
		UPDATE "SupportTicket" SET status = $1, "resolvedAt" = %s, "updatedAt" = NOW() WHERE id = $2`, resolvedAt),
		status, id)
	if err != nil {
		return nil, err
	}
	return r.GetTicket(ctx, id)
}

func (r *PgSuperAdminRepository) UpdateTicketPriority(ctx context.Context, id, priority string) (*domain.SupportTicket, error) {
	_, err := r.db.ExecContext(ctx, `UPDATE "SupportTicket" SET priority = $1, "updatedAt" = NOW() WHERE id = $2`, priority, id)
	if err != nil {
		return nil, err
	}
	return r.GetTicket(ctx, id)
}

// ===================== ERROR LOGS =====================

func (r *PgSuperAdminRepository) ListErrorLogs(ctx context.Context, filter application.ListFilter) ([]*domain.ErrorLog, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Resolved == "false" {
		where += ` AND resolved = false`
	} else if filter.Resolved == "true" {
		where += ` AND resolved = true`
	}
	if filter.Code != "" {
		where += fmt.Sprintf(` AND code = $%d`, idx)
		args = append(args, filter.Code)
		idx++
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (message ILIKE $%d OR code ILIKE $%d OR url ILIKE $%d)`, idx, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}
	if filter.From != "" {
		where += fmt.Sprintf(` AND "createdAt" >= $%d::timestamptz`, idx)
		args = append(args, filter.From)
		idx++
	}
	// ponytail: `to` is start-of-day inclusive, not end-of-day — fine until a date picker ships.
	if filter.To != "" {
		where += fmt.Sprintf(` AND "createdAt" <= $%d::timestamptz`, idx)
		args = append(args, filter.To)
		idx++
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "ErrorLog" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, "requestId", method, url, "httpStatus", code, message, stack, "tenantId", "userId",
		       "ipAddress", resolved, "createdAt"
		FROM "ErrorLog" %s ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.ErrorLog
	for rows.Next() {
		e := &domain.ErrorLog{}
		if err := rows.Scan(&e.ID, &e.RequestID, &e.Method, &e.URL, &e.HTTPStatus, &e.Code, &e.Message, &e.Stack,
			&e.TenantID, &e.UserID, &e.IPAddress, &e.Resolved, &e.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, e)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) ResolveErrorLog(ctx context.Context, id string, resolved bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE "ErrorLog" SET resolved = $1 WHERE id = $2`, resolved, id)
	return err
}

// ===================== BLOG =====================

func (r *PgSuperAdminRepository) ListBlogPosts(ctx context.Context, filter application.ListFilter) ([]*domain.BlogPost, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Status == "published" {
		where += ` AND published = true`
	} else if filter.Status == "draft" {
		where += ` AND published = false`
	}
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (title ILIKE $%d OR slug ILIKE $%d)`, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "BlogPost" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, slug, title, description, keywords, content, "coverImage", published, "publishedAt",
		       "authorId", "createdAt", "updatedAt"
		FROM "BlogPost" %s ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.BlogPost
	for rows.Next() {
		b := &domain.BlogPost{}
		if err := rows.Scan(&b.ID, &b.Slug, &b.Title, &b.Description, &b.Keywords, &b.Content, &b.CoverImage,
			&b.Published, &b.PublishedAt, &b.AuthorID, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, b)
	}
	return list, total, nil
}

func (r *PgSuperAdminRepository) GetBlogPost(ctx context.Context, id string) (*domain.BlogPost, error) {
	b := &domain.BlogPost{}
	err := r.db.QueryRowContext(ctx, `
		SELECT id, slug, title, description, keywords, content, "coverImage", published, "publishedAt",
		       "authorId", "createdAt", "updatedAt"
		FROM "BlogPost" WHERE id = $1`, id,
	).Scan(&b.ID, &b.Slug, &b.Title, &b.Description, &b.Keywords, &b.Content, &b.CoverImage,
		&b.Published, &b.PublishedAt, &b.AuthorID, &b.CreatedAt, &b.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return b, nil
}

func (r *PgSuperAdminRepository) CreateBlogPost(ctx context.Context, input application.BlogPostInput, authorID string) (*domain.BlogPost, error) {
	slug := ""
	if input.Slug != nil {
		slug = *input.Slug
	}
	title := ""
	if input.Title != nil {
		title = *input.Title
	}
	description := ""
	if input.Description != nil {
		description = *input.Description
	}
	content := ""
	if input.Content != nil {
		content = *input.Content
	}
	published := false
	if input.Published != nil {
		published = *input.Published
	}
	b := &domain.BlogPost{AuthorID: authorID}
	var publishedAt interface{}
	if published {
		publishedAt = time.Now()
	}
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "BlogPost" (id, slug, title, description, keywords, content, "coverImage", published, "publishedAt", "authorId", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, "createdAt", "updatedAt"`,
		slug, title, description, input.Keywords, content, input.CoverImage, published, publishedAt, authorID,
	).Scan(&b.ID, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	b.Slug = slug
	b.Title = title
	b.Description = description
	b.Keywords = input.Keywords
	b.Content = content
	b.CoverImage = input.CoverImage
	b.Published = published
	return b, nil
}

func (r *PgSuperAdminRepository) UpdateBlogPost(ctx context.Context, id string, input application.BlogPostInput) (*domain.BlogPost, error) {
	_, err := r.db.ExecContext(ctx, `
		UPDATE "BlogPost" SET
			slug = COALESCE($1, slug),
			title = COALESCE($2, title),
			description = COALESCE($3, description),
			keywords = COALESCE($4, keywords),
			content = COALESCE($5, content),
			"coverImage" = COALESCE($6, "coverImage"),
			published = COALESCE($7, published),
			"publishedAt" = CASE WHEN $7 = true AND "publishedAt" IS NULL THEN NOW() ELSE "publishedAt" END,
			"updatedAt" = NOW()
		WHERE id = $8`,
		input.Slug, input.Title, input.Description, input.Keywords, input.Content, input.CoverImage, input.Published, id)
	if err != nil {
		return nil, err
	}
	return r.GetBlogPost(ctx, id)
}

func (r *PgSuperAdminRepository) DeleteBlogPost(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "BlogPost" WHERE id = $1`, id)
	return err
}

// ===================== AUDIT LOG =====================

func (r *PgSuperAdminRepository) ListAuditLogs(ctx context.Context, filter application.ListFilter) ([]*domain.AuditLog, int64, error) {
	where := "WHERE 1=1"
	args := []interface{}{}
	idx := 1
	if filter.Search != "" {
		where += fmt.Sprintf(` AND (action ILIKE $%d OR "actorEmail" ILIKE $%d OR "targetType" ILIKE $%d)`, idx, idx, idx)
		args = append(args, "%"+filter.Search+"%")
		idx++
	}

	var total int64
	_ = r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM "AuditLog" `+where, args...).Scan(&total)

	offset := (filter.Page - 1) * filter.Limit
	args = append(args, filter.Limit, offset)
	query := fmt.Sprintf(`
		SELECT id, action, "targetType", "targetId", "tenantId", "actorId", "actorEmail", reason, "ipAddress", "createdAt"
		FROM "AuditLog" %s ORDER BY "createdAt" DESC LIMIT $%d OFFSET $%d`, where, idx, idx+1)
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*domain.AuditLog
	for rows.Next() {
		a := &domain.AuditLog{}
		if err := rows.Scan(&a.ID, &a.Action, &a.TargetType, &a.TargetID, &a.TenantID, &a.ActorID, &a.ActorEmail, &a.Reason, &a.IPAddress, &a.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, a)
	}
	return list, total, nil
}

// ===================== SUPER-ADMIN SELF =====================

func (r *PgSuperAdminRepository) UpdateSuperAdminPassword(ctx context.Context, id, currentPassword, newPassword string) error {
	var hash string
	err := r.db.QueryRowContext(ctx, `SELECT "passwordHash" FROM "SuperAdmin" WHERE id = $1`, id).Scan(&hash)
	if err != nil {
		return fmt.Errorf("super-admin not found")
	}
	// Verify current password before allowing the change.
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(currentPassword)); err != nil {
		return fmt.Errorf("current password is incorrect")
	}
	newHash, err := auth.HashPassword(newPassword)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `UPDATE "SuperAdmin" SET "passwordHash" = $1, "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW() WHERE id = $2`, newHash, id)
	return err
}

func (r *PgSuperAdminRepository) RevokeSuperAdminSessions(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE "SuperAdmin" SET "sessionVersion" = "sessionVersion" + 1, "updatedAt" = NOW() WHERE id = $1`, id)
	return err
}

// GetTenantPerformance computes cross-tenant performance rows for the
// /super-admin/performance page. Mirrors legacy pos-saas getTenantPerformance,
// but as 5 GROUP BY queries (vs ~6N). sort ∈ {rev30d,revAll,orders30d,ordersAll,name}.
func (r *PgSuperAdminRepository) GetTenantPerformance(ctx context.Context, sort string) ([]map[string]any, error) {
	since30d := time.Now().Add(-30 * 24 * time.Hour)
	now := time.Now()
	const day = 24 * time.Hour

	// q1 — tenants + subscription status + trial
	tRows, err := r.db.QueryContext(ctx, `
		SELECT t.id, t.name, t.slug, COALESCE(t."isActive", false), t."trialEndsAt", t."createdAt",
		       COALESCE((SELECT s.status::text FROM "Subscription" s WHERE s."tenantId" = t.id LIMIT 1), '')
		FROM "Tenant" AS t`)
	if err != nil {
		return nil, fmt.Errorf("performance tenants: %w", err)
	}
	defer tRows.Close()
	type base struct {
		id, name, slug, sub string
		active              bool
		trial               sql.NullTime
		created             time.Time
	}
	var bases []base
	for tRows.Next() {
		var b base
		if err := tRows.Scan(&b.id, &b.name, &b.slug, &b.active, &b.trial, &b.created, &b.sub); err != nil {
			return nil, fmt.Errorf("performance tenant scan: %w", err)
		}
		bases = append(bases, b)
	}
	if err := tRows.Err(); err != nil {
		return nil, err
	}

	// q2 — outlets per tenant
	outlets := map[string][2]int{} // [total, active]
	oRows, err := r.db.QueryContext(ctx, `SELECT "tenantId", COUNT(*), COUNT(*) FILTER (WHERE "isActive") FROM "Branch" GROUP BY "tenantId"`)
	if err != nil {
		return nil, fmt.Errorf("performance outlets: %w", err)
	}
	for oRows.Next() {
		var tid string
		var total, act int64
		if err := oRows.Scan(&tid, &total, &act); err != nil {
			oRows.Close()
			return nil, err
		}
		outlets[tid] = [2]int{int(total), int(act)}
	}
	oRows.Close()

	// q3 — orders per tenant (via branch): all, 30d, last
	type ord struct{ all, d30 int64; last sql.NullTime }
	orders := map[string]ord{}
	r3, err := r.db.QueryContext(ctx, `
		SELECT b."tenantId",
		       COUNT(*) FILTER (WHERE o.status <> 'CANCELED'),
		       COUNT(*) FILTER (WHERE o.status <> 'CANCELED' AND o."createdAt" >= $1),
		       MAX(o."createdAt")
		FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" GROUP BY b."tenantId"`, since30d)
	if err != nil {
		return nil, fmt.Errorf("performance orders: %w", err)
	}
	for r3.Next() {
		var tid string
		var o ord
		if err := r3.Scan(&tid, &o.all, &o.d30, &o.last); err != nil {
			r3.Close()
			return nil, err
		}
		orders[tid] = o
	}
	r3.Close()

	// q4 — revenue per tenant (Payment→Order→Branch): all, 30d
	type rev struct{ all, d30 float64 }
	revs := map[string]rev{}
	r4, err := r.db.QueryContext(ctx, `
		SELECT b."tenantId",
		       COALESCE(SUM(p.amount),0)::float8,
		       COALESCE(SUM(p.amount) FILTER (WHERE p."paidAt" >= $1),0)::float8
		FROM "Payment" p
		JOIN "Order" o ON o.id = p."orderId"
		JOIN "Branch" b ON b.id = o."branchId"
		GROUP BY b."tenantId"`, since30d)
	if err != nil {
		return nil, fmt.Errorf("performance revenue: %w", err)
	}
	for r4.Next() {
		var tid string
		var rv rev
		if err := r4.Scan(&tid, &rv.all, &rv.d30); err != nil {
			r4.Close()
			return nil, err
		}
		revs[tid] = rv
	}
	r4.Close()

	// q5 — SaaS paid per tenant
	saas := map[string]float64{}
	r5, err := r.db.QueryContext(ctx, `SELECT "tenantId", COALESCE(SUM(amount),0)::float8 FROM "SaaSPayment" WHERE status = 'PAID' GROUP BY "tenantId"`)
	if err != nil {
		return nil, fmt.Errorf("performance saas: %w", err)
	}
	for r5.Next() {
		var tid string
		var amt float64
		if err := r5.Scan(&tid, &amt); err != nil {
			r5.Close()
			return nil, err
		}
		saas[tid] = amt
	}
	r5.Close()

	rows := make([]map[string]any, 0, len(bases))
	for _, b := range bases {
		ot := outlets[b.id]
		o := orders[b.id]
		rv := revs[b.id]
		var trialEndsAt any
		var trialDays any
		if b.trial.Valid {
			trialEndsAt = b.trial.Time
			days := int(math.Ceil(b.trial.Time.Sub(now).Hours() / 24))
			if days < 0 {
				days = 0
			}
			trialDays = days
		}
		var daysSince any
		if o.last.Valid {
			d := int(math.Floor(now.Sub(o.last.Time).Hours() / 24))
			daysSince = d
		}
		var subStatus any
		if b.sub != "" {
			subStatus = b.sub
		}
		rows = append(rows, map[string]any{
			"id":                 b.id,
			"name":               b.name,
			"slug":               b.slug,
			"isActive":           b.active,
			"subscriptionStatus": subStatus,
			"trialEndsAt":        trialEndsAt,
			"trialDaysRemaining": trialDays,
			"activeOutlets":      ot[1],
			"totalOutlets":       ot[0],
			"orders30d":          o.d30,
			"ordersAll":          o.all,
			"revenue30d":         rv.d30,
			"revenueAll":         rv.all,
			"saasRevenuePaid":    saas[b.id],
			"daysSinceLastOrder": daysSince,
			"createdAt":          b.created,
		})
	}

	sortRows(rows, sort)
	return rows, nil
}

// sortRows orders performance rows by the given key (default rev30d).
func sortRows(rows []map[string]any, sort string) {
	num := func(r map[string]any, k string) float64 {
		if v, ok := r[k].(float64); ok {
			return v
		}
		return 0
	}
	switch sort {
	case "revAll":
		sortSlice(rows, func(a, b map[string]any) bool { return num(a, "revenueAll") > num(b, "revenueAll") })
	case "orders30d":
		sortSlice(rows, func(a, b map[string]any) bool { return num(a, "orders30d") > num(b, "orders30d") })
	case "ordersAll":
		sortSlice(rows, func(a, b map[string]any) bool { return num(a, "ordersAll") > num(b, "ordersAll") })
	case "name":
		sortSlice(rows, func(a, b map[string]any) bool { return a["name"].(string) < b["name"].(string) })
	default: // rev30d
		sortSlice(rows, func(a, b map[string]any) bool { return num(a, "revenue30d") > num(b, "revenue30d") })
	}
}

func sortSlice(rows []map[string]any, less func(a, b map[string]any) bool) {
	sort.Slice(rows, func(i, j int) bool { return less(rows[i], rows[j]) })
}

// ListAdmins returns all platform-staff accounts for the /super-admin/admins page.
// ponytail: list-only — create/update/delete not migrated (FE admins-manager posts/patches/deletes).
func (r *PgSuperAdminRepository) ListAdmins(ctx context.Context) ([]map[string]any, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, email, name, COALESCE(role::text, 'SUPER_ADMIN'), "createdAt"
		FROM "SuperAdmin" ORDER BY "createdAt"`)
	if err != nil {
		return nil, fmt.Errorf("listing admins: %w", err)
	}
	defer rows.Close()
	var out []map[string]any
	for rows.Next() {
		var id, email, name, role string
		var createdAt time.Time
		if err := rows.Scan(&id, &email, &name, &role, &createdAt); err != nil {
			return nil, fmt.Errorf("scanning admin row: %w", err)
		}
		out = append(out, map[string]any{
			"id":        id,
			"email":     email,
			"name":      name,
			"role":      role,
			"createdAt": createdAt,
		})
	}
	return out, rows.Err()
}

// CreateAdmin inserts a platform-staff account. passwordHash must be bcrypt.
func (r *PgSuperAdminRepository) CreateAdmin(ctx context.Context, email, name, passwordHash, role string) (map[string]any, error) {
	if role == "" {
		role = "SUPER_ADMIN"
	}
	var id string
	var createdAt time.Time
	err := r.db.QueryRowContext(ctx, `
		INSERT INTO "SuperAdmin" (id, email, name, "passwordHash", role, "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW(), NOW()) RETURNING id, "createdAt"`,
		email, name, passwordHash, role).Scan(&id, &createdAt)
	if err != nil {
		return nil, fmt.Errorf("creating admin: %w", err)
	}
	return map[string]any{"id": id, "email": email, "name": name, "role": role, "createdAt": createdAt}, nil
}

// UpdateAdminRole changes a platform-staff account's role.
func (r *PgSuperAdminRepository) UpdateAdminRole(ctx context.Context, id, role string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE "SuperAdmin" SET role = $1, "updatedAt" = NOW() WHERE id = $2`, role, id)
	return err
}

// DeleteAdmin removes a platform-staff account (hard delete).
func (r *PgSuperAdminRepository) DeleteAdmin(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM "SuperAdmin" WHERE id = $1`, id)
	return err
}

func (r *PgSuperAdminRepository) CreateImpersonation(ctx context.Context, input application.ImpersonInput) (string, error) {
	// ponytail: 4 — returns a placeholder token. Real implementation should mint a short-lived JWT scoped to the
	// target tenant/user with an "impersonatingSuperAdminId" claim, then the auth middleware detects the swap.
	return fmt.Sprintf("impersonate-%s-%d", input.UserID, time.Now().Unix()), nil
}

// GetPickupInsights aggregates cross-tenant pickup-request rejection analytics.
// from/to are optional YYYY-MM-DD bounds on createdAt.
func (r *PgSuperAdminRepository) GetPickupInsights(ctx context.Context, from, to string) (*domain.PickupInsights, error) {
	out := &domain.PickupInsights{
		TopReasons:        []domain.PickupInsightReason{},
		TopTenantsByRate:  []domain.PickupInsightTenant{},
		TopBranchesByRate: []domain.PickupInsightBranch{},
	}
	dateClause := ""
	args := []interface{}{}
	idx := 1
	if from != "" {
		dateClause += fmt.Sprintf(` AND "createdAt" >= $%d`, idx)
		args = append(args, from)
		idx++
	}
	if to != "" {
		dateClause += fmt.Sprintf(` AND "createdAt" <= $%d`, idx)
		args = append(args, to+" 23:59:59")
		idx++
	}

	if err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'REJECTED') FROM "PickupRequest" WHERE 1=1`+dateClause,
		args...,
	).Scan(&out.TotalAll, &out.TotalRejected); err != nil {
		return nil, fmt.Errorf("pickup totals: %w", err)
	}
	if out.TotalAll > 0 {
		out.RejectionRate = float64(out.TotalRejected) / float64(out.TotalAll)
	}

	if out.TotalRejected > 0 {
		rows, err := r.db.QueryContext(ctx,
			`SELECT COALESCE("rejectedReason", ''), COUNT(*) FROM "PickupRequest"
			 WHERE status = 'REJECTED'`+dateClause+`
			 GROUP BY COALESCE("rejectedReason", '') ORDER BY COUNT(*) DESC LIMIT 10`,
			args...)
		if err != nil {
			return nil, fmt.Errorf("pickup reasons: %w", err)
		}
		for rows.Next() {
			var reason string
			var count int64
			if err := rows.Scan(&reason, &count); err != nil {
				rows.Close()
				return nil, err
			}
			out.TopReasons = append(out.TopReasons, domain.PickupInsightReason{
				Reason: reason, Count: count, Pct: float64(count) / float64(out.TotalRejected),
			})
		}
		rows.Close()
	}

	tRows, err := r.db.QueryContext(ctx,
		`SELECT t.id, t.name, COUNT(*) AS total, COUNT(*) FILTER (WHERE p.status = 'REJECTED') AS rej
		 FROM "PickupRequest" p JOIN "Tenant" t ON t.id = p."tenantId"
		 WHERE 1=1`+dateClause+`
		 GROUP BY t.id, t.name ORDER BY rej DESC LIMIT 10`,
		args...)
	if err != nil {
		return nil, fmt.Errorf("pickup tenants: %w", err)
	}
	for tRows.Next() {
		var t domain.PickupInsightTenant
		if err := tRows.Scan(&t.TenantID, &t.TenantName, &t.Total, &t.Rejected); err != nil {
			tRows.Close()
			return nil, err
		}
		if t.Total > 0 {
			t.Rate = float64(t.Rejected) / float64(t.Total)
		}
		out.TopTenantsByRate = append(out.TopTenantsByRate, t)
	}
	tRows.Close()

	bRows, err := r.db.QueryContext(ctx,
		`SELECT p."tenantId", t.name, COALESCE(b.name, p."branchId"), COUNT(*) AS total,
		        COUNT(*) FILTER (WHERE p.status = 'REJECTED') AS rej
		 FROM "PickupRequest" p
		 JOIN "Tenant" t ON t.id = p."tenantId"
		 LEFT JOIN "Branch" b ON b.id = p."branchId"
		 WHERE p."branchId" IS NOT NULL`+dateClause+`
		 GROUP BY p."tenantId", t.name, COALESCE(b.name, p."branchId") ORDER BY rej DESC LIMIT 10`,
		args...)
	if err != nil {
		return nil, fmt.Errorf("pickup branches: %w", err)
	}
	for bRows.Next() {
		var b domain.PickupInsightBranch
		if err := bRows.Scan(&b.TenantID, &b.TenantName, &b.BranchName, &b.Total, &b.Rejected); err != nil {
			bRows.Close()
			return nil, err
		}
		if b.Total > 0 {
			b.Rate = float64(b.Rejected) / float64(b.Total)
		}
		out.TopBranchesByRate = append(out.TopBranchesByRate, b)
	}
	return out, bRows.Err()
}
