package application

import (
	"context"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/pickup/domain"
)

// CreateInput is the body for POST /pickup-requests.
type CreateInput struct {
	CustomerName  string  `json:"customerName"`
	CustomerPhone *string `json:"customerPhone,omitempty"`
	CustomerID    *string `json:"customerId,omitempty"`
	Address       *string `json:"address,omitempty"`
	RequestedDate *string `json:"requestedDate,omitempty"`
	RequestedSlot *string `json:"requestedSlot,omitempty"`
	Notes         *string `json:"notes,omitempty"`
	BranchID      string  `json:"branchId"`
}

// ListFilter paginates + filters the pickup request list.
type ListFilter struct {
	BranchID string
	Status   string
	Search   string
	Page     int
	Limit    int
}

// TransitionInput covers accept/reject/schedule/assign/convert.
type TransitionInput struct {
	ScheduledDate *string `json:"scheduledDate,omitempty"`
	ScheduledSlot *string `json:"scheduledSlot,omitempty"`
	AssignedTo    *string `json:"assignedTo,omitempty"`
	Reason        *string `json:"reason,omitempty"`
}

// Repository is the port for pickup persistence (hexagonal).
type Repository interface {
	Create(ctx context.Context, p *domain.PickupRequest) error
	FindByID(ctx context.Context, id, tenantID string) (*domain.PickupRequest, error)
	List(ctx context.Context, tenantID string, f ListFilter) ([]*domain.PickupRequest, int64, error)
	UpdateStatus(ctx context.Context, id, tenantID string, status domain.PickupStatus, inp TransitionInput) error
	CountPending(ctx context.Context, tenantID, branchID string) (int64, error)
}

// Service implements the pickup use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) Create(ctx context.Context, input CreateInput, tenantID string) (*domain.PickupRequest, error) {
	if input.CustomerName == "" {
		return nil, fmt.Errorf("customerName is required")
	}
	if input.BranchID == "" {
		return nil, fmt.Errorf("branchId is required")
	}
	// "customerPhone" + "addressText" are NOT NULL in the DB but optional in the API
	// (CreateInput uses *string, omitempty → nil when omitted). Coerce nil → "" so an
	// insert without a phone/address doesn't 500 on the NOT NULL constraint.
	phone := input.CustomerPhone
	if phone == nil {
		empty := ""
		phone = &empty
	}
	address := input.Address
	if address == nil {
		empty := ""
		address = &empty
	}
	p := &domain.PickupRequest{
		TenantID:      tenantID,
		BranchID:      input.BranchID,
		Status:        domain.PickupPending,
		CustomerName:  input.CustomerName,
		CustomerPhone: phone,
		CustomerID:    input.CustomerID,
		Address:       address,
		RequestedSlot: input.RequestedSlot,
		Notes:         input.Notes,
	}
	// Parse the caller-supplied requestedDate (FE sends a string) so it persists.
	if input.RequestedDate != nil && *input.RequestedDate != "" {
		if t, perr := time.Parse("2006-01-02", *input.RequestedDate); perr == nil {
			p.RequestedDate = &t
		} else if t, perr := time.Parse(time.RFC3339, *input.RequestedDate); perr == nil {
			p.RequestedDate = &t
		}
	}
	if err := s.Repo.Create(ctx, p); err != nil {
		return nil, fmt.Errorf("creating pickup request: %w", err)
	}
	return p, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*domain.PickupRequest, error) {
	p, err := s.Repo.FindByID(ctx, id, tenantID)
	if err != nil || p == nil {
		return nil, fmt.Errorf("pickup request not found")
	}
	return p, nil
}

func (s *Service) List(ctx context.Context, tenantID string, f ListFilter) ([]*domain.PickupRequest, int64, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	return s.Repo.List(ctx, tenantID, f)
}

// Accept moves a PENDING request to ACCEPTED.
func (s *Service) Accept(ctx context.Context, id, tenantID string) error {
	return s.transition(ctx, id, tenantID, domain.PickupAccepted, TransitionInput{})
}

// Reject moves a request to REJECTED.
func (s *Service) Reject(ctx context.Context, id, tenantID string, inp TransitionInput) error {
	return s.transition(ctx, id, tenantID, domain.PickupRejected, inp)
}

// Schedule moves a request to SCHEDULED with a date/slot.
func (s *Service) Schedule(ctx context.Context, id, tenantID string, inp TransitionInput) error {
	if inp.ScheduledDate == nil {
		return fmt.Errorf("scheduledDate is required")
	}
	return s.transition(ctx, id, tenantID, domain.PickupScheduled, inp)
}

// Assign moves a request to ASSIGNED with an assignee.
func (s *Service) Assign(ctx context.Context, id, tenantID string, inp TransitionInput) error {
	if inp.AssignedTo == nil {
		return fmt.Errorf("assignedTo is required")
	}
	return s.transition(ctx, id, tenantID, domain.PickupAssigned, inp)
}

// Convert marks a request as CONVERTED and links the created order ID.
// The actual Order creation is the caller's responsibility (the orders module).
func (s *Service) Convert(ctx context.Context, id, tenantID string, inp TransitionInput) error {
	if inp.AssignedTo == nil {
		return fmt.Errorf("convertedOrderId is required (pass as assignedTo)")
	}
	return s.transition(ctx, id, tenantID, domain.PickupConverted, inp)
}

// transition is the shared guard + update for status changes.
func (s *Service) transition(ctx context.Context, id, tenantID string, status domain.PickupStatus, inp TransitionInput) error {
	current, err := s.Repo.FindByID(ctx, id, tenantID)
	if err != nil || current == nil {
		return fmt.Errorf("pickup request not found")
	}
	return s.Repo.UpdateStatus(ctx, id, tenantID, status, inp)
}

func (s *Service) CountPending(ctx context.Context, tenantID, branchID string) (int64, error) {
	return s.Repo.CountPending(ctx, tenantID, branchID)
}
