package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/orders/domain"
)

// CreateOrderInput mirrors the TS CreateOrderInput DTO.
type CreateOrderInput struct {
	CustomerID     string                 `json:"customerId"`
	Items          []OrderItemInput       `json:"items"`
	Notes          string                 `json:"notes,omitempty"`
	DiscountType   string                 `json:"discountType,omitempty"`
	DiscountAmount float64                `json:"discountAmount,omitempty"`
	ReceivedAt     *string                `json:"receivedAt,omitempty"`
}

type OrderItemInput struct {
	ServiceID  string  `json:"serviceId"`
	Quantity   float64 `json:"quantity"`
	WeightKg   *float64 `json:"weightKg,omitempty"`
}

// Repository is the port for order persistence (hexagonal architecture).
type Repository interface {
	Create(ctx context.Context, order *domain.Order, items []domain.OrderItem) error
	FindByID(ctx context.Context, id, tenantID string) (*domain.Order, error)
	FindByClientID(ctx context.Context, clientID string) (*domain.Order, error)
	List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Order, int64, error)
	UpdateStatus(ctx context.Context, id, tenantID string, status domain.OrderStatus) error
	Delete(ctx context.Context, id, tenantID string) error
}

type ListFilter struct {
	BranchID    string
	Status      string
	Search      string
	Page        int
	Limit       int
}

// Service implements the order use cases.
type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

// Create creates a new order (idempotent via ClientID).
func (s *Service) Create(ctx context.Context, input CreateOrderInput, tenantID, branchID, userID string, clientID *string) (*domain.Order, error) {
	// Idempotency check
	if clientID != nil {
		existing, err := s.repo.FindByClientID(ctx, *clientID)
		if err == nil && existing != nil {
			return existing, nil // Already created — return the same order
		}
	}

	order := &domain.Order{
		Status:        domain.StatusReceived,
		PaymentStatus: domain.PaymentPending,
		Notes:         input.Notes,
		TenantID:      tenantID,
		BranchID:      branchID,
		Module:        "LAUNDRY",
		ClientID:      clientID,
	}

	var items []domain.OrderItem
	for _, it := range input.Items {
		items = append(items, domain.OrderItem{
			ServiceID:    it.ServiceID,
			Quantity:     it.Quantity,
			WeightKg:     it.WeightKg,
		})
	}

	if err := s.repo.Create(ctx, order, items); err != nil {
		return nil, fmt.Errorf("creating order: %w", err)
	}

	return order, nil
}

// Get retrieves a single order.
func (s *Service) Get(ctx context.Context, id, tenantID string) (*domain.Order, error) {
	order, err := s.repo.FindByID(ctx, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("finding order: %w", err)
	}
	if order == nil {
		return nil, fmt.Errorf("order not found")
	}
	return order, nil
}

// List returns paginated orders for a tenant.
func (s *Service) List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Order, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	return s.repo.List(ctx, tenantID, filter)
}
