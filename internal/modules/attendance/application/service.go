package application

import (
	"context"
	"fmt"

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

	nextType := domain.ClockIn
	if last != nil && last.Type == domain.ClockIn {
		nextType = domain.ClockOut
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
	hash, err := hashPIN(input.Pin)
	if err != nil {
		return nil, fmt.Errorf("hashing pin: %w", err)
	}
	return s.Repo.CreateQuickStaff(ctx, input.Name, hash, input.BranchID)
}

// VerifyPIN checks a plaintext PIN against the stored hash.
// Returns nil on match, an error otherwise.
func VerifyPIN(pin, hash string) error {
	return comparePIN(pin, hash)
}
