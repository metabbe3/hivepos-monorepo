package infrastructure

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/tenant/application"
	"github.com/hivepos/api/internal/modules/tenant/domain"
)

type PgTenantRepository struct {
	db *sql.DB
}

func NewPgTenantRepository(db *sql.DB) *PgTenantRepository {
	return &PgTenantRepository{db: db}
}

func (r *PgTenantRepository) GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error) {
	t := &domain.Tenant{}
	var settings sql.NullString
	var activeModules []byte
	err := r.db.QueryRowContext(ctx, `
		SELECT id, name, slug, "ownerEmail", "ownerName", "ownerPhone", "logoUrl",
		       "customDomain", "activeModules", settings, "isActive",
		       "onboardingCompletedAt", "websiteEnabled", "websitePublishedAt",
		       "referralCode", "trialEndsAt", "createdAt", "updatedAt"
		FROM "Tenant" WHERE id = $1`, tenantID,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.OwnerEmail, &t.OwnerName, &t.OwnerPhone, &t.LogoURL,
		&t.CustomDomain, &activeModules, &settings, &t.IsActive,
		&t.OnboardingCompletedAt, &t.WebsiteEnabled, &t.WebsitePublishedAt,
		&t.ReferralCode, &t.TrialEndsAt, &t.CreatedAt, &t.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("finding tenant: %w", err)
	}
	if activeModules != nil {
		json.Unmarshal(activeModules, &t.ActiveModules)
	}
	if settings.Valid {
		t.Settings = json.RawMessage(settings.String)
	}
	return t, nil
}

func (r *PgTenantRepository) CompleteOnboarding(ctx context.Context, tenantID string, input application.CompleteOnboardingInput) (*domain.Tenant, error) {
	modules := input.ActiveModules
	if modules == nil {
		modules = []string{"laundry"}
	}
	modulesJSON, _ := json.Marshal(modules)

	var settingsJSON interface{}
	if len(input.Settings) > 0 {
		b, _ := json.Marshal(input.Settings)
		settingsJSON = string(b)
	}

	_, err := r.db.ExecContext(ctx, `
		UPDATE "Tenant"
		SET "activeModules" = $1, settings = COALESCE($2, settings),
		    "onboardingCompletedAt" = COALESCE("onboardingCompletedAt", NOW()),
		    "updatedAt" = NOW()
		WHERE id = $3`,
		string(modulesJSON), settingsJSON, tenantID)
	if err != nil {
		return nil, fmt.Errorf("completing onboarding: %w", err)
	}
	return r.GetTenant(ctx, tenantID)
}

func (r *PgTenantRepository) GetWebsite(ctx context.Context, tenantID string) (*domain.WebsiteConfig, error) {
	var settings sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT settings FROM "Tenant" WHERE id = $1`, tenantID).Scan(&settings)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	w := &domain.WebsiteConfig{}
	if settings.Valid && settings.String != "" {
		_ = json.Unmarshal([]byte(settings.String), w)
	}
	return w, nil
}

func (r *PgTenantRepository) UpdateWebsite(ctx context.Context, tenantID string, input application.WebsiteInput) (*domain.WebsiteConfig, error) {
	w, err := r.GetWebsite(ctx, tenantID)
	if err != nil {
		return nil, err
	}
	if w == nil {
		w = &domain.WebsiteConfig{}
	}
	// Merge partial input into existing website config.
	if input.Title != nil {
		w.Title = *input.Title
	}
	if input.Description != nil {
		w.Description = *input.Description
	}
	if input.LogoURL != nil {
		w.LogoURL = *input.LogoURL
	}
	if input.HeroImage != nil {
		w.HeroImage = *input.HeroImage
	}
	if input.PrimaryColor != nil {
		w.PrimaryColor = *input.PrimaryColor
	}
	if input.ContactPhone != nil {
		w.ContactPhone = *input.ContactPhone
	}
	if input.ContactEmail != nil {
		w.ContactEmail = *input.ContactEmail
	}
	if input.Address != nil {
		w.Address = *input.Address
	}
	if input.Enabled != nil {
		w.Enabled = *input.Enabled
	}

	settingsJSON, _ := json.Marshal(w)
	_, err = r.db.ExecContext(ctx, `UPDATE "Tenant" SET settings = $1, "updatedAt" = NOW() WHERE id = $2`,
		string(settingsJSON), tenantID)
	if err != nil {
		return nil, fmt.Errorf("updating website settings: %w", err)
	}
	return w, nil
}

func (r *PgTenantRepository) DeleteWebsite(ctx context.Context, tenantID string) error {
	w := &domain.WebsiteConfig{Enabled: false}
	settingsJSON, _ := json.Marshal(w)
	_, err := r.db.ExecContext(ctx,
		`UPDATE "Tenant" SET settings = $1, "websiteEnabled" = false, "websitePublishedAt" = NULL, "updatedAt" = NOW() WHERE id = $2`,
		string(settingsJSON), tenantID)
	return err
}

func (r *PgTenantRepository) GetWhatsAppTemplates(ctx context.Context, tenantID string) (*domain.WhatsAppTemplates, error) {
	var settings sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT settings FROM "Tenant" WHERE id = $1`, tenantID).Scan(&settings)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	// The TS app stores WhatsApp templates under settings.whatsappTemplates.
	raw := map[string]json.RawMessage{}
	t := &domain.WhatsAppTemplates{}
	if settings.Valid && settings.String != "" {
		_ = json.Unmarshal([]byte(settings.String), &raw)
		if v, ok := raw["whatsappTemplates"]; ok {
			_ = json.Unmarshal(v, t)
		}
	}
	return t, nil
}

func (r *PgTenantRepository) UpdateWhatsAppTemplates(ctx context.Context, tenantID string, templates domain.WhatsAppTemplates) (*domain.WhatsAppTemplates, error) {
	var settings sql.NullString
	_ = r.db.QueryRowContext(ctx, `SELECT settings FROM "Tenant" WHERE id = $1`, tenantID).Scan(&settings)

	raw := map[string]interface{}{}
	if settings.Valid && settings.String != "" {
		_ = json.Unmarshal([]byte(settings.String), &raw)
	}
	raw["whatsappTemplates"] = templates

	settingsJSON, _ := json.Marshal(raw)
	_, err := r.db.ExecContext(ctx, `UPDATE "Tenant" SET settings = $1, "updatedAt" = NOW() WHERE id = $2`,
		string(settingsJSON), tenantID)
	if err != nil {
		return nil, fmt.Errorf("updating whatsapp templates: %w", err)
	}
	return &templates, nil
}

func (r *PgTenantRepository) GetReferral(ctx context.Context, tenantID string) (*domain.ReferralInfo, error) {
	info := &domain.ReferralInfo{}
	var referralCode sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT "referralCode" FROM "Tenant" WHERE id = $1`, tenantID).Scan(&referralCode)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if referralCode.Valid {
		info.ReferralCode = referralCode.String
	}
	// Count referrals given by this tenant + how many were rewarded.
	_ = r.db.QueryRowContext(ctx, `
		SELECT COUNT(*), COALESCE(SUM(CASE WHEN status = 'REWARDED' THEN 1 ELSE 0 END), 0)
		FROM "Referral" WHERE "referrerId" = $1`, tenantID,
	).Scan(&info.ReferralsCount, &info.RewardedCount)
	info.RewardMonths = 1
	info.Status = "ACTIVE"
	return info, nil
}

// keep time import referenced for future publish-timestamp use
var _ = time.Now
