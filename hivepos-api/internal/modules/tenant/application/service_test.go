package application_test

import (
	"context"
	"testing"

	"github.com/hivepos/api/internal/modules/tenant/application"
	"github.com/hivepos/api/internal/modules/tenant/domain"
)

type fakeRepo struct {
	tenant      *domain.Tenant
	website     *domain.WebsiteConfig
	templates   *domain.WhatsAppTemplates
	referral    *domain.ReferralInfo
	lastOnboard application.CompleteOnboardingInput
}

func (f *fakeRepo) GetTenant(_ context.Context, _ string) (*domain.Tenant, error) {
	return f.tenant, nil
}
func (f *fakeRepo) CompleteOnboarding(_ context.Context, _ string, in application.CompleteOnboardingInput) (*domain.Tenant, error) {
	f.lastOnboard = in
	return f.tenant, nil
}
func (f *fakeRepo) GetWebsite(_ context.Context, _ string) (*domain.WebsiteConfig, error) {
	return f.website, nil
}
func (f *fakeRepo) UpdateWebsite(_ context.Context, _ string, _ application.WebsiteInput) (*domain.WebsiteConfig, error) {
	return f.website, nil
}
func (f *fakeRepo) DeleteWebsite(_ context.Context, _ string) error { return nil }
func (f *fakeRepo) GetWhatsAppTemplates(_ context.Context, _ string) (*domain.WhatsAppTemplates, error) {
	return f.templates, nil
}
func (f *fakeRepo) UpdateWhatsAppTemplates(_ context.Context, _ string, t domain.WhatsAppTemplates) (*domain.WhatsAppTemplates, error) {
	return &t, nil
}
func (f *fakeRepo) GetReferral(_ context.Context, _ string) (*domain.ReferralInfo, error) {
	return f.referral, nil
}

func TestGetTenant_Delegates(t *testing.T) {
	r := &fakeRepo{tenant: &domain.Tenant{ID: "t1", Name: "Acme"}}
	got, err := application.NewService(r).GetTenant(context.Background(), "t1")
	if err != nil || got.Name != "Acme" {
		t.Fatalf("GetTenant: %v / %+v", err, got)
	}
}

func TestCompleteOnboarding_Delegates(t *testing.T) {
	r := &fakeRepo{tenant: &domain.Tenant{ID: "t1"}}
	in := application.CompleteOnboardingInput{ActiveModules: []string{"laundry"}}
	if _, err := application.NewService(r).CompleteOnboarding(context.Background(), "t1", in); err != nil {
		t.Fatal(err)
	}
	if len(r.lastOnboard.ActiveModules) != 1 {
		t.Fatalf("input not forwarded: %+v", r.lastOnboard)
	}
}

func TestGetWebsite_Delegates(t *testing.T) {
	r := &fakeRepo{website: &domain.WebsiteConfig{Slug: "x"}}
	got, _ := application.NewService(r).GetWebsite(context.Background(), "t1")
	if got.Slug != "x" {
		t.Fatalf("GetWebsite: %+v", got)
	}
}
