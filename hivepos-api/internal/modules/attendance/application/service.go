package application

import (
	"context"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/auth"
	"github.com/hivepos/api/internal/modules/attendance/domain"
)

// ListFilter controls the attendance event query.
type ListFilter struct {
	BranchID string
	UserID   string
	From     string
	To       string
	Page     int
	Limit    int
}

// CreateEventInput is the body for manual event creation.
type CreateEventInput struct {
	UserID    string                `json:"userId"`
	Type      domain.ClockEventType `json:"type"`
	Timestamp *string               `json:"timestamp,omitempty"`
	Notes     string                `json:"notes,omitempty"`
}

// UpdateEventInput is the body for editing an event.
type UpdateEventInput struct {
	Type      *domain.ClockEventType `json:"type,omitempty"`
	Timestamp *string                `json:"timestamp,omitempty"`
}

// QuickStaffInput creates an attendance-only user.
type QuickStaffInput struct {
	Name     string `json:"name"`
	Pin      string `json:"pin"`
	BranchID string `json:"branchId"`
}

// Repository is the port for attendance persistence (hexagonal).
type Repository interface {
	ListStaff(ctx context.Context, tenantID string) ([]*domain.StaffMember, error)
	FindStaffByPIN(ctx context.Context, tenantID, userID string) (*domain.StaffMember, error)
	ListStatus(ctx context.Context, tenantID, branchID string) ([]*domain.StaffStatus, error)
	LastEvent(ctx context.Context, userID string) (*domain.ClockEvent, error)
	CreateEvent(ctx context.Context, e *domain.ClockEvent) error
	FindEventByID(ctx context.Context, id, tenantID string) (*domain.ClockEvent, error)
	UpdateEvent(ctx context.Context, id, tenantID string, upd UpdateEventInput) error
	DeleteEvent(ctx context.Context, id, tenantID string) error
	ListEvents(ctx context.Context, tenantID string, f ListFilter) ([]*domain.ClockEvent, int64, error)
	CreateQuickStaff(ctx context.Context, name, pinHash, branchID string) (*domain.StaffMember, error)
}

// Service implements the attendance use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

// ListStaff returns all staff members for the tenant.
func (s *Service) ListStaff(ctx context.Context, tenantID string) ([]*domain.StaffMember, error) {
	return s.Repo.ListStaff(ctx, tenantID)
}

// ListStatus returns who's currently clocked in.
func (s *Service) ListStatus(ctx context.Context, tenantID, branchID string) ([]*domain.StaffStatus, error) {
	return s.Repo.ListStatus(ctx, tenantID, branchID)
}

// Clock verifies the staff member exists and toggles a clock event.
// PIN verification is done in the route layer (bcrypt) before calling this —
// the service trusts the authenticated userID once the PIN check passes.
func (s *Service) Clock(ctx context.Context, tenantID, branchID, userID string) (*domain.ClockEvent, error) {
	last, err := s.Repo.LastEvent(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("reading last event: %w", err)
	}

	now := time.Now()
	nextType := domain.ClockIn
	if last != nil && last.Type == domain.ClockIn {
		if !sameDay(last.Timestamp, now) {
			// Forgot to clock out on a previous day — auto-close the stale IN at the
			// end of that day so the overnight span doesn't inflate worked-hours.
			// (CreateEvent honors e.Timestamp when set; otherwise NOW().)
			closeOut := &domain.ClockEvent{
				UserID:    last.UserID,
				TenantID:  last.TenantID,
				BranchID:  last.BranchID,
				Type:      domain.ClockOut,
				Timestamp: endOfDay(last.Timestamp),
			}
			if err := s.Repo.CreateEvent(ctx, closeOut); err != nil {
				return nil, fmt.Errorf("auto-closing stale clock-in: %w", err)
			}
			// nextType stays CLOCK_IN — start a fresh session today.
		} else {
			nextType = domain.ClockOut
		}
	}

	e := &domain.ClockEvent{
		UserID:   userID,
		TenantID: tenantID,
		BranchID: branchID,
		Type:     nextType,
	}
	if err := s.Repo.CreateEvent(ctx, e); err != nil {
		return nil, fmt.Errorf("creating clock event: %w", err)
	}
	return e, nil
}

// sameDay reports whether two timestamps fall on the same calendar day.
func sameDay(a, b time.Time) bool {
	ay, am, ad := a.Date()
	by, bm, bd := b.Date()
	return ay == by && am == bm && ad == bd
}

// endOfDay returns 23:59:59 of the given timestamp's calendar day (same location).
func endOfDay(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 23, 59, 59, 0, t.Location())
}

// ListEvents returns paginated clock events.
func (s *Service) ListEvents(ctx context.Context, tenantID string, f ListFilter) ([]*domain.ClockEvent, int64, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 50
	}
	return s.Repo.ListEvents(ctx, tenantID, f)
}

// CreateEvent is a manual add (manager override).
func (s *Service) CreateEvent(ctx context.Context, input CreateEventInput, tenantID, branchID string) (*domain.ClockEvent, error) {
	if input.UserID == "" {
		return nil, fmt.Errorf("userId is required")
	}
	e := &domain.ClockEvent{
		UserID:   input.UserID,
		TenantID: tenantID,
		BranchID: branchID,
		Type:     input.Type,
	}
	if err := s.Repo.CreateEvent(ctx, e); err != nil {
		return nil, fmt.Errorf("creating event: %w", err)
	}
	return e, nil
}

// UpdateEvent edits an existing event.
func (s *Service) UpdateEvent(ctx context.Context, id, tenantID string, upd UpdateEventInput) error {
	return s.Repo.UpdateEvent(ctx, id, tenantID, upd)
}

// DeleteEvent removes an event.
func (s *Service) DeleteEvent(ctx context.Context, id, tenantID string) error {
	return s.Repo.DeleteEvent(ctx, id, tenantID)
}

// CreateQuickStaff creates an attendance-only user (no login).
func (s *Service) CreateQuickStaff(ctx context.Context, input QuickStaffInput, tenantID string) (*domain.StaffMember, error) {
	if input.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if len(input.Pin) < 4 {
		return nil, fmt.Errorf("pin must be at least 4 digits")
	}
	hash, err := auth.HashPassword(input.Pin)
	if err != nil {
		return nil, fmt.Errorf("hashing pin: %w", err)
	}
	return s.Repo.CreateQuickStaff(ctx, input.Name, hash, input.BranchID)
}

// VerifyPIN checks a plaintext PIN against the stored hash.
// Returns nil on match, an error otherwise.
func VerifyPIN(pin, hash string) error {
	return auth.ComparePassword(hash, pin)
}
