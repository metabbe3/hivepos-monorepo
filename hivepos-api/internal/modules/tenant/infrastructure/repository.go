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
	var slug, plan string
	var websiteEnabled bool
	var websitePublishedAt sql.NullTime
	var settingsStr sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT slug, 'PRO', "websiteEnabled", "websitePublishedAt", settings FROM "Tenant" WHERE id = $1`,
		tenantID).Scan(&slug, &plan, &websiteEnabled, &websitePublishedAt, &settingsStr)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	w := &domain.WebsiteConfig{
		Plan:           plan,
		Slug:           slug,
		WebsiteEnabled: websiteEnabled,
		Subdomain:      slug + ".hivepos.id",
		Settings:       json.RawMessage("{}"),
	}
	if websitePublishedAt.Valid {
		s := websitePublishedAt.Time.UTC().Format("2006-01-02T15:04:05.000Z")
		w.WebsitePublishedAt = &s
	}
	// Extract website settings from the settings JSON (under "website" key).
	if settingsStr.Valid && settingsStr.String != "" {
		raw := map[string]json.RawMessage{}
		if json.Unmarshal([]byte(settingsStr.String), &raw) == nil {
			if v, ok := raw["website"]; ok {
				w.Settings = v
			}
		}
	}
	return w, nil
}

func (r *PgTenantRepository) UpdateWebsite(ctx context.Context, tenantID string, input application.WebsiteInput) (*domain.WebsiteConfig, error) {
	// Store the website settings as JSON in the settings column under "website".
	// Merge (||) into any existing website object so partial updates don't drop
	// previously-saved fields (the dashboard omits empty fields from the PATCH body).
	settingsFields := map[string]interface{}{}
	if input.Tagline != nil {
		settingsFields["tagline"] = *input.Tagline
	}
	if input.HeroPhotoURL != nil {
		settingsFields["heroPhotoUrl"] = *input.HeroPhotoURL
	}
	if input.About != nil {
		settingsFields["about"] = *input.About
	}
	if input.Instagram != nil {
		settingsFields["instagram"] = *input.Instagram
	}
	if input.QrisImageURL != nil {
		settingsFields["qrisImageUrl"] = *input.QrisImageURL
	}
	if input.GoogleRating != nil {
		settingsFields["googleRating"] = *input.GoogleRating
	}
	if input.GoogleReviewCount != nil {
		settingsFields["googleReviewCount"] = *input.GoogleReviewCount
	}
	if input.YearEstablished != nil {
		settingsFields["yearEstablished"] = *input.YearEstablished
	}
	if input.AvgProcessingMinutes != nil {
		settingsFields["avgProcessingMinutes"] = *input.AvgProcessingMinutes
	}
	if input.AreaServed != nil {
		settingsFields["areaServed"] = input.AreaServed
	}
	if input.Faqs != nil {
		settingsFields["faqs"] = input.Faqs
	}
	if input.Testimonials != nil {
		settingsFields["testimonials"] = input.Testimonials
	}
	websiteJSON, _ := json.Marshal(settingsFields)
	_, err := r.db.ExecContext(ctx,
		`UPDATE "Tenant" SET settings = jsonb_set(COALESCE(settings, '{}'), '{website}', COALESCE(settings->'website', '{}') || $1::jsonb), "updatedAt" = NOW() WHERE id = $2`,
		string(websiteJSON), tenantID)
	if err != nil {
		return nil, fmt.Errorf("updating website settings: %w", err)
	}
	return r.GetWebsite(ctx, tenantID)
}

func (r *PgTenantRepository) DeleteWebsite(ctx context.Context, tenantID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE "Tenant" SET "websiteEnabled" = false, "websitePublishedAt" = NULL, "updatedAt" = NOW() WHERE id = $1`,
		tenantID)
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
	// TS returns {overrides, defaults, effective, manifest}.
	// overrides = tenant-customized templates; defaults = system defaults.
	t := &domain.WhatsAppTemplates{
		Overrides: map[string]string{},
		Defaults:  map[string]string{},
		Effective: map[string]string{},
		Manifest:  json.RawMessage(`[{"id":"order.receipt","label":"Order Update","description":"Sent when staff update order status.","category":"Orders","variables":[{"name":"orderNumber","description":"Order number","required":true}],"defaultBody":"Halo, ini terkait pesanan *{{orderNumber}}*","maxLength":2000},{"id":"order.trackingShare","label":"Tracking Share","description":"Share order tracking link.","category":"Orders","variables":[{"name":"customerName","description":"Customer name","required":true}],"defaultBody":"Halo {{customerName}}","maxLength":2000},{"id":"track.customerInquiry","label":"Customer Inquiry","description":"Customer inquiry template.","category":"Tracking","variables":[{"name":"branchName","description":"Branch name","required":true}],"defaultBody":"Halo {{branchName}}","maxLength":2000},{"id":"pickup.request","label":"Pickup Request","description":"Pickup request template.","category":"Pickup","variables":[],"defaultBody":"Halo, saya mau request pickup","maxLength":2000},{"id":"priceEstimator.summary","label":"Price Estimate","description":"Price estimate summary.","category":"Pricing","variables":[{"name":"totalAmount","description":"Total amount","required":true}],"defaultBody":"Estimasi: {{totalAmount}}","maxLength":2000},{"id":"status.RECEIVED","label":"Status Received","description":"Order received status.","category":"Status","variables":[],"defaultBody":"Pesanan diterima.","maxLength":2000},{"id":"status.IN_PROGRESS","label":"Status In Progress","description":"Order in progress status.","category":"Status","variables":[],"defaultBody":"Pesanan sedang dikerjakan.","maxLength":2000},{"id":"status.READY","label":"Status Ready","description":"Order ready status.","category":"Status","variables":[],"defaultBody":"Pesanan siap diambil.","maxLength":2000},{"id":"status.DELIVERED","label":"Status Delivered","description":"Order delivered status.","category":"Status","variables":[],"defaultBody":"Pesanan selesai.","maxLength":2000},{"id":"unpaid.reminder","label":"Unpaid Reminder","description":"Payment reminder.","category":"Payment","variables":[],"defaultBody":"Pengingat: pesanan belum lunas.","maxLength":2000},{"id":"tenantSite.askCta","label":"Ask CTA","description":"Website ask CTA.","category":"Website","variables":[],"defaultBody":"Punya pertanyaan?","maxLength":2000},{"id":"tenantSite.orderCta","label":"Order CTA","description":"Website order CTA.","category":"Website","variables":[],"defaultBody":"Pesan sekarang!","maxLength":2000}]`),
	}
	if settings.Valid && settings.String != "" {
		raw := map[string]json.RawMessage{}
		if json.Unmarshal([]byte(settings.String), &raw) == nil {
			if v, ok := raw["whatsappTemplates"]; ok {
				_ = json.Unmarshal(v, &t.Overrides)
			}
		}
	}
	// Defaults are the system-provided templates (matching TS default template catalog).
	for k, v := range map[string]string{
		"order.receipt":          "Halo, ini terkait pesanan *{{orderNumber}}*\nStatus: *{{statusLabel}}*",
		"order.trackingShare":    "Halo {{customerName}}, pesanan laundry kamu bisa dilacak di sini:\n\n{{trackingUrl}}",
		"track.customerInquiry":  "Halo {{branchName}}, saya mau tanya pesanan saya.",
		"pickup.request":         "Halo, saya mau request pickup laundry.",
		"priceEstimator.summary": "Estimasi harga: {{totalAmount}}",
		"status.RECEIVED":        "Pesanan diterima.",
		"status.IN_PROGRESS":     "Pesanan sedang dikerjakan.",
		"status.READY":           "Pesanan siap diambil.",
		"status.DELIVERED":       "Pesanan selesai.",
		"unpaid.reminder":        "Pengingat: pesanan Anda belum lunas.",
		"tenantSite.askCta":      "Punya pertanyaan?",
		"tenantSite.orderCta":    "Pesan sekarang!",
	} {
		t.Defaults[k] = v
	}
	// Effective = defaults overridden by tenant customizations.
	for k, v := range t.Defaults {
		t.Effective[k] = v
	}
	for k, v := range t.Overrides {
		t.Effective[k] = v
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
	info := &domain.ReferralInfo{Cap: 12, RewardMonths: 1}
	var referralCode sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT "referralCode" FROM "Tenant" WHERE id = $1`, tenantID).Scan(&referralCode)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if referralCode.Valid {
		info.Code = referralCode.String
		info.ShareURL = "https://hivepos.id/register?ref=" + referralCode.String
	}
	// Count referrals: rewarded vs pending.
	var rewarded, total int64
	_ = r.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(CASE WHEN status = 'REWARDED' THEN 1 ELSE 0 END), 0), COUNT(*)
		FROM "Referral" WHERE "referrerId" = $1`, tenantID,
	).Scan(&rewarded, &total)
	info.Rewarded = rewarded
	info.Pending = total - rewarded
	return info, nil
}

// keep time import referenced for future publish-timestamp use
var _ = time.Now
