package application_test

import (
	"context"
	"testing"

	"github.com/hivepos/api/internal/modules/superadmin/application"
	"github.com/hivepos/api/internal/modules/superadmin/domain"
)

// fakeRepo stubs all 47 superadmin Repository methods. Superadmin services are
// thin delegates, so tests verify delegation + filter forwarding + error surfacing.
type fakeRepo struct {
	tenant  *domain.Tenant
	stats   *domain.PlatformStats
	err     error
	lastFlt application.ListFilter
	total   int64
	lastID  string
}

func (f *fakeRepo) GetPlatformStats(_ context.Context) (*domain.PlatformStats, error) {
	return f.stats, f.err
}
func (f *fakeRepo) GetBillingOverview(_ context.Context) (*domain.BillingOverview, error) {
	return nil, f.err
}
func (f *fakeRepo) ListTenants(_ context.Context, fl application.ListFilter) ([]*domain.Tenant, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) GetTenant(_ context.Context, id string) (*domain.Tenant, error) {
	f.lastID = id
	return f.tenant, f.err
}
func (f *fakeRepo) UpdateTenant(_ context.Context, _ string, _ application.TenantInput) (*domain.Tenant, error) {
	return f.tenant, f.err
}
func (f *fakeRepo) ApproveTenant(_ context.Context, _ string) (*domain.Tenant, error) {
	return f.tenant, f.err
}
func (f *fakeRepo) SuspendTenant(_ context.Context, _ string, _ bool) (*domain.Tenant, error) {
	return f.tenant, f.err
}
func (f *fakeRepo) GetTenantBilling(_ context.Context, _ string) (interface{}, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateTenantSubscription(_ context.Context, _ string, _ application.SubscriptionInput) (*domain.Subscription, error) {
	return nil, f.err
}
func (f *fakeRepo) ExtendTrial(_ context.Context, _ string, _ int) (*domain.Subscription, error) {
	return nil, f.err
}
func (f *fakeRepo) ListUsers(_ context.Context, fl application.ListFilter) ([]*domain.User, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) SuspendUser(_ context.Context, _ string, _ bool) (*domain.User, error) {
	return nil, f.err
}
func (f *fakeRepo) ResetUserPassword(_ context.Context, _ string) (string, error) { return "", f.err }
func (f *fakeRepo) ListPayments(_ context.Context, fl application.ListFilter) ([]*domain.SaaSPayment, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) RefundPayment(_ context.Context, _ string) (*domain.SaaSPayment, error) {
	return nil, f.err
}
func (f *fakeRepo) ListPlans(_ context.Context) ([]*domain.Plan, error) { return nil, f.err }
func (f *fakeRepo) CreatePlan(_ context.Context, _ application.PlanInput) (*domain.Plan, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdatePlan(_ context.Context, _ string, _ application.PlanInput) (*domain.Plan, error) {
	return nil, f.err
}
func (f *fakeRepo) DeletePlan(_ context.Context, _ string) error { return f.err }
func (f *fakeRepo) ListPromoCodes(_ context.Context, fl application.ListFilter) ([]*domain.PromoCode, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) CreatePromoCode(_ context.Context, _ application.PromoCodeInput) (*domain.PromoCode, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdatePromoCode(_ context.Context, _ string, _ application.PromoCodeInput) (*domain.PromoCode, error) {
	return nil, f.err
}
func (f *fakeRepo) DeletePromoCode(_ context.Context, _ string) error { return f.err }
func (f *fakeRepo) ListFeatureFlags(_ context.Context) ([]*domain.FeatureFlag, error) {
	return nil, f.err
}
func (f *fakeRepo) CreateFeatureFlag(_ context.Context, _ application.FeatureFlagInput) (*domain.FeatureFlag, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateFeatureFlag(_ context.Context, _ string, _ application.FeatureFlagInput) (*domain.FeatureFlag, error) {
	return nil, f.err
}
func (f *fakeRepo) DeleteFeatureFlag(_ context.Context, _ string) error { return f.err }
func (f *fakeRepo) ListTenantFlags(_ context.Context, _ string) ([]*domain.TenantFeatureFlag, error) {
	return nil, f.err
}
func (f *fakeRepo) UpsertTenantFlag(_ context.Context, _ string, _ application.TenantFlagInput) (*domain.TenantFeatureFlag, error) {
	return nil, f.err
}
func (f *fakeRepo) DeleteTenantFlag(_ context.Context, _, _ string) error { return f.err }
func (f *fakeRepo) ListReferrals(_ context.Context, fl application.ListFilter) ([]*domain.Referral, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) UpdateReferral(_ context.Context, _, _, _ string) (*domain.Referral, error) {
	return nil, f.err
}
func (f *fakeRepo) ListTickets(_ context.Context, fl application.ListFilter) ([]*domain.SupportTicket, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) GetTicket(_ context.Context, _ string) (*domain.SupportTicket, error) {
	return nil, f.err
}
func (f *fakeRepo) AddTicketComment(_ context.Context, _, _, _, _ string) (*domain.TicketComment, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateTicketStatus(_ context.Context, _ string, _ string) (*domain.SupportTicket, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateTicketPriority(_ context.Context, _ string, _ string) (*domain.SupportTicket, error) {
	return nil, f.err
}
func (f *fakeRepo) ListErrorLogs(_ context.Context, fl application.ListFilter) ([]*domain.ErrorLog, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) ResolveErrorLog(_ context.Context, _ string, _ bool) error { return f.err }
func (f *fakeRepo) ListBlogPosts(_ context.Context, fl application.ListFilter) ([]*domain.BlogPost, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) GetBlogPost(_ context.Context, _ string) (*domain.BlogPost, error) {
	return nil, f.err
}
func (f *fakeRepo) CreateBlogPost(_ context.Context, _ application.BlogPostInput, _ string) (*domain.BlogPost, error) {
	return nil, f.err
}
func (f *fakeRepo) UpdateBlogPost(_ context.Context, _ string, _ application.BlogPostInput) (*domain.BlogPost, error) {
	return nil, f.err
}
func (f *fakeRepo) DeleteBlogPost(_ context.Context, _ string) error { return f.err }
func (f *fakeRepo) ListAuditLogs(_ context.Context, fl application.ListFilter) ([]*domain.AuditLog, int64, error) {
	f.lastFlt = fl
	return nil, f.total, f.err
}
func (f *fakeRepo) UpdateSuperAdminPassword(_ context.Context, _, _, _ string) error { return f.err }
func (f *fakeRepo) RevokeSuperAdminSessions(_ context.Context, _ string) error       { return f.err }
func (f *fakeRepo) CreateImpersonation(_ context.Context, _ application.ImpersonInput) (string, error) {
	return "impersonate-stub", f.err
}
func (f *fakeRepo) GetPickupInsights(_ context.Context, _, _ string) (*domain.PickupInsights, error) {
	return &domain.PickupInsights{}, f.err
}

func TestListTenants_ForwardsFilter(t *testing.T) {
	r := &fakeRepo{total: 3}
	_, total, err := application.NewService(r).ListTenants(context.Background(), application.ListFilter{Page: 2, Limit: 10})
	if err != nil || total != 3 || r.lastFlt.Page != 2 {
		t.Fatalf("ListTenants: %d/%v/filter=%+v", total, err, r.lastFlt)
	}
}

func TestGetTenant_DelegatesID(t *testing.T) {
	r := &fakeRepo{tenant: &domain.Tenant{ID: "t1"}}
	got, err := application.NewService(r).GetTenant(context.Background(), "t1")
	if err != nil || got == nil || r.lastID != "t1" {
		t.Fatalf("GetTenant: %v / %+v / id=%s", err, got, r.lastID)
	}
}

func TestApproveTenant_Delegates(t *testing.T) {
	r := &fakeRepo{tenant: &domain.Tenant{ID: "t1"}}
	got, err := application.NewService(r).ApproveTenant(context.Background(), "t1")
	if err != nil || got == nil {
		t.Fatalf("ApproveTenant: %v / %+v", err, got)
	}
}

func TestSuspendTenant_Delegates(t *testing.T) {
	r := &fakeRepo{tenant: &domain.Tenant{ID: "t1"}}
	got, err := application.NewService(r).SuspendTenant(context.Background(), "t1")
	if err != nil || got == nil {
		t.Fatalf("SuspendTenant: %v / %+v", err, got)
	}
}

func TestSuperadmin_ErrorSurfaces(t *testing.T) {
	r := &fakeRepo{err: errStr("db")}
	if _, err := application.NewService(r).ListPlans(context.Background()); err == nil {
		t.Fatal("ListPlans must surface error")
	}
	if _, err := application.NewService(r).GetStats(context.Background()); err == nil {
		t.Fatal("GetStats must surface error")
	}
}

type errStr string

func (e errStr) Error() string { return string(e) }
