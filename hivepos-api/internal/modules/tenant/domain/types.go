package domain

import (
	"encoding/json"
	"time"
)

// Tenant mirrors the platform Tenant row, scoped to the settings/onboarding/website fields
// the tenant-management API exposes. It is NOT the full cross-tenant model used by super-admin.
type Tenant struct {
	ID                    string          `json:"id"`
	Name                  string          `json:"name"`
	Slug                  string          `json:"slug"`
	OwnerEmail            string          `json:"ownerEmail"`
	OwnerName             *string         `json:"ownerName"`
	OwnerPhone            *string         `json:"ownerPhone"`
	LogoURL               *string         `json:"logoUrl"`
	CustomDomain          *string         `json:"customDomain"`
	ActiveModules         []string        `json:"activeModules"`
	Settings              json.RawMessage `json:"settings,omitempty"`
	IsActive              bool            `json:"isActive"`
	OnboardingCompletedAt *time.Time      `json:"onboardingCompletedAt,omitempty"`
	WebsiteEnabled        bool            `json:"websiteEnabled"`
	WebsitePublishedAt    *time.Time      `json:"websitePublishedAt,omitempty"`
	ReferralCode          *string         `json:"referralCode,omitempty"`
	TrialEndsAt           *time.Time      `json:"trialEndsAt,omitempty"`
	CreatedAt             time.Time       `json:"createdAt"`
	UpdatedAt             time.Time       `json:"updatedAt"`
}

// WebsiteConfig mirrors TS /api/tenant/website response.
type WebsiteConfig struct {
	Plan               string          `json:"plan"`
	Slug               string          `json:"slug"`
	WebsiteEnabled     bool            `json:"websiteEnabled"`
	WebsitePublishedAt *string         `json:"websitePublishedAt"`
	Subdomain          string          `json:"subdomain"`
	Settings           json.RawMessage `json:"settings"`
}

// WhatsAppTemplates mirrors TS /api/tenant/whatsapp-templates: {overrides, defaults, effective, manifest}.
type WhatsAppTemplates struct {
	Overrides map[string]string `json:"overrides"`
	Defaults  map[string]string `json:"defaults"`
	Effective map[string]string `json:"effective"`
	Manifest  json.RawMessage   `json:"manifest"`
}

// ReferralInfo is the tenant's own referral code + usage stats.
type ReferralInfo struct {
	Code         string `json:"code"`
	Rewarded     int64  `json:"rewarded"`
	Pending      int64  `json:"pending"`
	Cap          int    `json:"cap"`
	RewardMonths int    `json:"rewardMonths"`
	ShareURL     string `json:"shareUrl"`
}
