package domain

import (
	"encoding/json"
	"time"
)

// Tenant mirrors the platform Tenant row, scoped to the settings/onboarding/website fields
// the tenant-management API exposes. It is NOT the full cross-tenant model used by super-admin.
type Tenant struct {
	ID                   string          `json:"id"`
	Name                 string          `json:"name"`
	Slug                 string          `json:"slug"`
	OwnerEmail           string          `json:"ownerEmail"`
	OwnerName            *string         `json:"ownerName"`
	OwnerPhone           *string         `json:"ownerPhone"`
	LogoURL              *string         `json:"logoUrl"`
	CustomDomain         *string         `json:"customDomain"`
	ActiveModules        []string        `json:"activeModules"`
	Settings             json.RawMessage `json:"settings,omitempty"`
	IsActive             bool            `json:"isActive"`
	OnboardingCompletedAt *time.Time     `json:"onboardingCompletedAt,omitempty"`
	WebsiteEnabled       bool            `json:"websiteEnabled"`
	WebsitePublishedAt   *time.Time      `json:"websitePublishedAt,omitempty"`
	ReferralCode         *string         `json:"referralCode,omitempty"`
	TrialEndsAt          *time.Time      `json:"trialEndsAt,omitempty"`
	CreatedAt            time.Time       `json:"createdAt"`
	UpdatedAt            time.Time       `json:"updatedAt"`
}

// WebsiteConfig is the tenant's public website configuration, stored as JSON
// in Tenant.settings (under the "website" key). The GET/PATCH/DELETE handlers
// read/write this shape.
type WebsiteConfig struct {
	Enabled        bool            `json:"enabled"`
	Title          string          `json:"title"`
	Description    string          `json:"description"`
	LogoURL        string          `json:"logoUrl"`
	HeroImage      string          `json:"heroImage"`
	PrimaryColor   string          `json:"primaryColor"`
	ContactPhone   string          `json:"contactPhone"`
	ContactEmail   string          `json:"contactEmail"`
	Address        string          `json:"address"`
	SocialLinks    json.RawMessage `json:"socialLinks,omitempty"`
	CustomDomain   string          `json:"customDomain"`
	PublishedAt    *time.Time      `json:"publishedAt,omitempty"`
}

// WhatsAppTemplates holds the tenant's WhatsApp message templates (order status updates).
type WhatsAppTemplates struct {
	OrderCreated     string `json:"orderCreated"`
	OrderInProgress  string `json:"orderInProgress"`
	OrderReady       string `json:"orderReady"`
	OrderCompleted   string `json:"orderCompleted"`
	PaymentReminder  string `json:"paymentReminder"`
}

// ReferralInfo is the tenant's own referral code + usage stats.
type ReferralInfo struct {
	ReferralCode   string `json:"referralCode"`
	ReferralsCount int64  `json:"referralsCount"`
	RewardedCount  int64  `json:"rewardedCount"`
	RewardMonths   int    `json:"rewardMonths"`
	Status         string `json:"status"`
}
