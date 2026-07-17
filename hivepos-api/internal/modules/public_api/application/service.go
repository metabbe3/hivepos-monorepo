package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/public_api/domain"
)

// Repository is the port for public-API persistence (hexagonal architecture).
// Public endpoints resolve the tenant by slug, never from the session.
type Repository interface {
	FindBranchesByTenantSlug(ctx context.Context, slug string) ([]*domain.PublicBranch, error)
	FindServicesByTenantSlug(ctx context.Context, slug, branchID string) ([]*domain.PublicService, error)
	FindPublicTenantBySlug(ctx context.Context, slug string) (*domain.PublicTenant, error)
	CreateSupportTicket(ctx context.Context, input domain.TicketInput) (string, error)
	FindOrderByNumber(ctx context.Context, orderNumber, phoneLast4 string) (*domain.PublicOrder, error)
	CreatePickupRequest(ctx context.Context, input domain.PickupInput) (string, error)
}

// Service implements the public-API use cases (read-only catalog + public submissions).
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

// ListBranches returns the public branch directory for a tenant (resolved by slug).
func (s *Service) ListBranches(ctx context.Context, slug string) ([]*domain.PublicBranch, error) {
	if slug == "" {
		return nil, fmt.Errorf("tenant slug is required")
	}
	branches, err := s.Repo.FindBranchesByTenantSlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("finding branches: %w", err)
	}
	return branches, nil
}

// ListServices returns the public service catalog for a tenant (optionally filtered to a branch).
func (s *Service) ListServices(ctx context.Context, slug, branchID string) ([]*domain.PublicService, error) {
	if slug == "" {
		return nil, fmt.Errorf("tenant slug is required")
	}
	services, err := s.Repo.FindServicesByTenantSlug(ctx, slug, branchID)
	if err != nil {
		return nil, fmt.Errorf("finding services: %w", err)
	}
	return services, nil
}

// SubmitTicket creates a public support ticket.
func (s *Service) SubmitTicket(ctx context.Context, input domain.TicketInput) (string, error) {
	if input.Name == "" || input.Email == "" || input.Message == "" {
		return "", fmt.Errorf("name, email, and message are required")
	}
	id, err := s.Repo.CreateSupportTicket(ctx, input)
	if err != nil {
		return "", fmt.Errorf("creating ticket: %w", err)
	}
	return id, nil
}

// TrackOrder looks up an order by orderNumber for public tracking.
// If phoneLast4 is provided, the caller has already validated the suffix.
func (s *Service) TrackOrder(ctx context.Context, orderNumber, phoneLast4 string) (*domain.PublicOrder, error) {
	if orderNumber == "" {
		return nil, fmt.Errorf("orderNumber is required")
	}
	order, err := s.Repo.FindOrderByNumber(ctx, orderNumber, phoneLast4)
	if err != nil {
		return nil, fmt.Errorf("finding order: %w", err)
	}
	if order == nil {
		return nil, nil
	}
	return order, nil
}

// RequestPickup creates a public pickup request.
func (s *Service) RequestPickup(ctx context.Context, input domain.PickupInput) (string, error) {
	if input.Name == "" || input.Phone == "" || input.TenantSlug == "" {
		return "", fmt.Errorf("name, phone, and tenantSlug are required")
	}
	id, err := s.Repo.CreatePickupRequest(ctx, input)
	if err != nil {
		return "", fmt.Errorf("creating pickup request: %w", err)
	}
	return id, nil
}

// GetPublicTenant returns the public website payload (identity + settings + branches) for an
// active tenant by slug. nil → not found / inactive.
func (s *Service) GetPublicTenant(ctx context.Context, slug string) (*domain.PublicTenant, error) {
	if slug == "" {
		return nil, fmt.Errorf("tenant slug is required")
	}
	t, err := s.Repo.FindPublicTenantBySlug(ctx, slug)
	if err != nil {
		return nil, fmt.Errorf("finding public tenant: %w", err)
	}
	return t, nil
}
