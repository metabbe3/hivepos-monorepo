package application_test

import (
	"context"
	"testing"

	"github.com/hivepos/api/internal/modules/pickup/application"
	"github.com/hivepos/api/internal/modules/pickup/domain"
)

type fakeRepo struct {
	items     map[string]*domain.PickupRequest
	lastFlt   application.ListFilter
	listTotal int64
	pending   int64
	updCalls  int
	updErr    error
}

func newFakeRepo() *fakeRepo { return &fakeRepo{items: map[string]*domain.PickupRequest{}} }

func (f *fakeRepo) Create(_ context.Context, p *domain.PickupRequest) error {
	p.ID = "pk-new"
	f.items[p.ID] = p
	return nil
}
func (f *fakeRepo) FindByID(_ context.Context, id, _ string) (*domain.PickupRequest, error) {
	return f.items[id], nil
}
func (f *fakeRepo) List(_ context.Context, _ string, fl application.ListFilter) ([]*domain.PickupRequest, int64, error) {
	f.lastFlt = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) UpdateStatus(_ context.Context, _, _ string, _ domain.PickupStatus, _ application.TransitionInput) error {
	f.updCalls++
	return f.updErr
}
func (f *fakeRepo) CountPending(_ context.Context, _, _ string) (int64, error) { return f.pending, nil }

func TestGet_NotFound(t *testing.T) {
	if _, err := application.NewService(newFakeRepo()).Get(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("missing pickup must error")
	}
}

func TestList_Clamps(t *testing.T) {
	r := newFakeRepo()
	application.NewService(r).List(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999})
	if r.lastFlt.Page != 1 || r.lastFlt.Limit != 20 {
		t.Fatalf("clamp = (%d,%d), want (1,20)", r.lastFlt.Page, r.lastFlt.Limit)
	}
}

func TestCountPending(t *testing.T) {
	r := newFakeRepo()
	r.pending = 7
	got, err := application.NewService(r).CountPending(context.Background(), "t1", "b1")
	if err != nil || got != 7 {
		t.Fatalf("CountPending = %d/%v", got, err)
	}
}

func TestTransitions_CallUpdateStatus(t *testing.T) {
	r := newFakeRepo()
	r.items["p1"] = &domain.PickupRequest{ID: "p1"}
	r.items["p2"] = &domain.PickupRequest{ID: "p2"}
	s := application.NewService(r)
	ctx := context.Background()
	_ = s.Accept(ctx, "p1", "t1")
	_ = s.Reject(ctx, "p1", "t1", application.TransitionInput{})
	_ = s.Accept(ctx, "p2", "t1") // Accept/Reject have no required-field guards
	if r.updCalls != 3 {
		t.Fatalf("UpdateStatus calls = %d, want 3", r.updCalls)
	}
}
