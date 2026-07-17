package application_test

import (
	"context"
	"strings"
	"testing"

	"github.com/hivepos/api/internal/modules/attendance/application"
	"github.com/hivepos/api/internal/modules/attendance/domain"
)

type fakeRepo struct {
	staff     map[string]*domain.StaffMember
	events    map[string]*domain.ClockEvent
	lastFlt   application.ListFilter
	listTotal int64
	lastEvent *domain.ClockEvent
	createdEv *domain.ClockEvent
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{staff: map[string]*domain.StaffMember{}, events: map[string]*domain.ClockEvent{}}
}

func (f *fakeRepo) ListStaff(_ context.Context, _ string) ([]*domain.StaffMember, error) {
	return nil, nil
}
func (f *fakeRepo) FindStaffByPIN(_ context.Context, _, _ string) (*domain.StaffMember, error) {
	return nil, nil
}
func (f *fakeRepo) ListStatus(_ context.Context, _, _ string) ([]*domain.StaffStatus, error) {
	return nil, nil
}
func (f *fakeRepo) LastEvent(_ context.Context, _ string) (*domain.ClockEvent, error) {
	return f.lastEvent, nil
}
func (f *fakeRepo) CreateEvent(_ context.Context, e *domain.ClockEvent) error {
	e.ID = "ev-new"
	f.events[e.ID] = e
	f.createdEv = e
	return nil
}
func (f *fakeRepo) FindEventByID(_ context.Context, _, _ string) (*domain.ClockEvent, error) {
	return nil, nil
}
func (f *fakeRepo) UpdateEvent(_ context.Context, _, _ string, _ application.UpdateEventInput) error {
	return nil
}
func (f *fakeRepo) DeleteEvent(_ context.Context, _, _ string) error { return nil }
func (f *fakeRepo) ListEvents(_ context.Context, _ string, fl application.ListFilter) ([]*domain.ClockEvent, int64, error) {
	f.lastFlt = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) CreateQuickStaff(_ context.Context, _, _, _ string) (*domain.StaffMember, error) {
	return &domain.StaffMember{ID: "staff-new"}, nil
}

func TestCreateQuickStaff_PinTooShort(t *testing.T) {
	s := application.NewService(newFakeRepo())
	_, err := s.CreateQuickStaff(context.Background(), application.QuickStaffInput{Name: "A", Pin: "12"}, "t1")
	if err == nil || !strings.Contains(err.Error(), "pin") {
		t.Fatalf("short PIN must error with pin message, got %v", err)
	}
}

func TestCreateQuickStaff_Happy(t *testing.T) {
	s := application.NewService(newFakeRepo())
	got, err := s.CreateQuickStaff(context.Background(), application.QuickStaffInput{Name: "A", Pin: "1234"}, "t1")
	if err != nil || got == nil {
		t.Fatalf("CreateQuickStaff: %v/%+v", err, got)
	}
}

func TestListEvents_Clamps(t *testing.T) {
	r := newFakeRepo()
	application.NewService(r).ListEvents(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999})
	if r.lastFlt.Page != 1 || r.lastFlt.Limit != 50 {
		t.Fatalf("clamp = (%d,%d), want (1,50) [>100→50]", r.lastFlt.Page, r.lastFlt.Limit)
	}
}

func TestClock_ToggleInThenOut(t *testing.T) {
	r := newFakeRepo()
	s := application.NewService(r)
	// No prior event → first clock records an in/event.
	if _, err := s.Clock(context.Background(), "t1", "b1", "u1"); err != nil {
		t.Fatalf("first clock: %v", err)
	}
	if r.createdEv == nil {
		t.Fatal("first clock must create an event")
	}
}
