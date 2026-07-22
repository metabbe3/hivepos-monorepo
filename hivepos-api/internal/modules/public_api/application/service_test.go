package application_test

import (
	"context"
	"testing"

	"github.com/hivepos/api/internal/modules/public_api/application"
	"github.com/hivepos/api/internal/modules/public_api/domain"
)

type fakeRepo struct {
	branches []*domain.PublicBranch
	services []*domain.PublicService
	order    *domain.PublicOrder
	ticketID string
	pickupID string
}

func (f *fakeRepo) FindBranchesByTenantSlug(_ context.Context, _ string) ([]*domain.PublicBranch, error) {
	return f.branches, nil
}
func (f *fakeRepo) FindPublicTenantBySlug(_ context.Context, _ string) (*domain.PublicTenant, error) {
	return nil, nil
}
func (f *fakeRepo) FindServicesByTenantSlug(_ context.Context, _, _ string) ([]*domain.PublicService, error) {
	return f.services, nil
}
func (f *fakeRepo) CreateSupportTicket(_ context.Context, _ domain.TicketInput) (string, error) {
	return f.ticketID, nil
}
func (f *fakeRepo) FindOrderByNumber(_ context.Context, _, _ string) (*domain.PublicOrder, error) {
	return f.order, nil
}
func (f *fakeRepo) CreatePickupRequest(_ context.Context, _ domain.PickupInput) (string, error) {
	return f.pickupID, nil
}

func (f *fakeRepo) FindPublishedBlogPosts(_ context.Context) ([]*domain.PublicBlogPost, error) {
	return nil, nil
}

func (f *fakeRepo) FindPublishedBlogPostBySlug(_ context.Context, _ string) (*domain.PublicBlogPost, error) {
	return nil, nil
}

func TestListBranches_RequiresSlug(t *testing.T) {
	if _, err := application.NewService(&fakeRepo{}).ListBranches(context.Background(), ""); err == nil {
		t.Fatal("empty slug must error")
	}
}

func TestListServices_RequiresSlug(t *testing.T) {
	if _, err := application.NewService(&fakeRepo{}).ListServices(context.Background(), "", "b1"); err == nil {
		t.Fatal("empty slug must error")
	}
}

func TestSubmitTicket_RequiresFields(t *testing.T) {
	s := application.NewService(&fakeRepo{})
	cases := []domain.TicketInput{
		{Name: "A", Email: "e"},    // missing message
		{Name: "A", Message: "m"},  // missing email
		{Email: "e", Message: "m"}, // missing name
	}
	for i, c := range cases {
		if _, err := s.SubmitTicket(context.Background(), c); err == nil {
			t.Fatalf("case %d must error on missing field", i)
		}
	}
}

func TestSubmitTicket_Happy(t *testing.T) {
	r := &fakeRepo{ticketID: "tick-1"}
	id, err := application.NewService(r).SubmitTicket(context.Background(), domain.TicketInput{Name: "A", Email: "e", Message: "m"})
	if err != nil || id != "tick-1" {
		t.Fatalf("SubmitTicket: %v / %s", err, id)
	}
}

func TestTrackOrder_RequiresNumber(t *testing.T) {
	if _, err := application.NewService(&fakeRepo{}).TrackOrder(context.Background(), "", "1234"); err == nil {
		t.Fatal("empty orderNumber must error")
	}
}

func TestTrackOrder_NotFoundReturnsNil(t *testing.T) {
	got, err := application.NewService(&fakeRepo{}).TrackOrder(context.Background(), "ORD-1", "1234")
	if err != nil || got != nil {
		t.Fatalf("missing order must be (nil,nil), got %v / %+v", err, got)
	}
}

func TestRequestPickup_RequiresFields(t *testing.T) {
	if _, err := application.NewService(&fakeRepo{}).RequestPickup(context.Background(), domain.PickupInput{Name: "A", Phone: "p"}); err == nil {
		t.Fatal("missing tenantSlug must error")
	}
}

func TestRequestPickup_Happy(t *testing.T) {
	r := &fakeRepo{pickupID: "pk-1"}
	id, err := application.NewService(r).RequestPickup(context.Background(), domain.PickupInput{Name: "A", Phone: "p", TenantSlug: "s"})
	if err != nil || id != "pk-1" {
		t.Fatalf("RequestPickup: %v / %s", err, id)
	}
}
