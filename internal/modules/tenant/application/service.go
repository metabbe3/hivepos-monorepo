package application

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/hivepos/api/internal/modules/tenant/domain"
)

// CompleteOnboardingInput is the PATCH /api/tenant/onboarding body.
type CompleteOnboardingInput struct {
	ActiveModules []string                `json:"activeModules"`
	Settings      map[string]interface{} `json:"settings"`
}

// WebsiteInput is the PATCH /api/tenant/website body.
type WebsiteInput struct {
	Title        *string `json:"title"`
	Description  *string `json:"description"`
	LogoURL      *string `json:"logoUrl"`
	HeroImage    *string `json:"heroImage"`
	PrimaryColor *string `json:"primaryColor"`
	ContactPhone *string `json:"contactPhone"`
	ContactEmail *string `json:"contactEmail"`
	Address      *string `json:"address"`
	Enabled      *bool   `json:"enabled"`
}

// Repository defines the persistence contract for the tenant-management module.
type Repository interface {
	GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error)
	CompleteOnboarding(ctx context.Context, tenantID string, input CompleteOnboardingInput) (*domain.Tenant, error)
	GetWebsite(ctx context.Context, tenantID string) (*domain.WebsiteConfig, error)
	UpdateWebsite(ctx context.Context, tenantID string, input WebsiteInput) (*domain.WebsiteConfig, error)
	DeleteWebsite(ctx context.Context, tenantID string) error
	GetWhatsAppTemplates(ctx context.Context, tenantID string) (*domain.WhatsAppTemplates, error)
	UpdateWhatsAppTemplates(ctx context.Context, tenantID string, t domain.WhatsAppTemplates) (*domain.WhatsAppTemplates, error)
	GetReferral(ctx context.Context, tenantID string) (*domain.ReferralInfo, error)
}

// Service is the tenant-management use-case layer.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) GetTenant(ctx context.Context, tenantID string) (*domain.Tenant, error) {
	t, err := s.Repo.GetTenant(ctx, tenantID)
	if err != nil || t == nil {
		return nil, fmt.Errorf("tenant not found")
	}
	return t, nil
}

func (s *Service) CompleteOnboarding(ctx context.Context, tenantID string, input CompleteOnboardingInput) (*domain.Tenant, error) {
	t, err := s.Repo.CompleteOnboarding(ctx, tenantID, input)
	if err != nil {
		return nil, fmt.Errorf("completing onboarding: %w", err)
	}
	return t, nil
}

func (s *Service) GetWebsite(ctx context.Context, tenantID string) (*domain.WebsiteConfig, error) {
	w, err := s.Repo.GetWebsite(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("loading website: %w", err)
	}
	if w == nil {
		return &domain.WebsiteConfig{}, nil
	}
	return w, nil
}

func (s *Service) UpdateWebsite(ctx context.Context, tenantID string, input WebsiteInput) (*domain.WebsiteConfig, error) {
	w, err := s.Repo.UpdateWebsite(ctx, tenantID, input)
	if err != nil {
		return nil, fmt.Errorf("updating website: %w", err)
	}
	return w, nil
}

func (s *Service) DeleteWebsite(ctx context.Context, tenantID string) error {
	return s.Repo.DeleteWebsite(ctx, tenantID)
}

func (s *Service) GetWhatsAppTemplates(ctx context.Context, tenantID string) (*domain.WhatsAppTemplates, error) {
	t, err := s.Repo.GetWhatsAppTemplates(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("loading whatsapp templates: %w", err)
	}
	if t == nil {
		return &domain.WhatsAppTemplates{}, nil
	}
	return t, nil
}

func (s *Service) UpdateWhatsAppTemplates(ctx context.Context, tenantID string, templates domain.WhatsAppTemplates) (*domain.WhatsAppTemplates, error) {
	return s.Repo.UpdateWhatsAppTemplates(ctx, tenantID, templates)
}

func (s *Service) GetReferral(ctx context.Context, tenantID string) (*domain.ReferralInfo, error) {
	r, err := s.Repo.GetReferral(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("loading referral: %w", err)
	}
	if r == nil {
		return &domain.ReferralInfo{}, nil
	}
	return r, nil
}

// keep json import referenced for future settings-shape expansion
var _ = json.RawMessage(nil)
