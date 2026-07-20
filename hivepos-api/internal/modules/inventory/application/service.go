package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/inventory/domain"
	"github.com/hivepos/api/internal/shared/apperror"
)

// CreateStockItemInput is the DTO for creating a stock item.
type CreateStockItemInput struct {
	Name                 string   `json:"name"`
	Unit                 string   `json:"unit"`
	CurrentQuantity      *float64 `json:"currentQuantity"`
	LowStockThreshold    *float64 `json:"lowStockThreshold"`
	PurchasePricePerUnit *float64 `json:"purchasePricePerUnit"`
	IsActive             *bool    `json:"isActive"`
}

// CreateMovementInput is the DTO for creating a stock movement.
type CreateMovementInput struct {
	Type     domain.MovementType `json:"type"`
	Quantity float64             `json:"quantity"`
	Notes    *string             `json:"notes"`
	Date     *string             `json:"date,omitempty"`
}

// ListFilter holds the query params for listing stock items.
type ListFilter struct {
	BranchID string
	Search   string
	Active   string
	LowOnly  string
	Page  int
	Limit int
	// All requests every row with no LIMIT/OFFSET — used by endpoints that are
	// unpaginated by design (e.g. /api/stock-items, matching the original TS contract).
	All bool
}

// Repository is the persistence port for stock items + movements.
type Repository interface {
	Create(ctx context.Context, s *domain.StockItem) error
	FindByID(ctx context.Context, id, tenantID string) (*domain.StockItem, error)
	List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.StockItem, int64, error)
	Update(ctx context.Context, s *domain.StockItem) error
	Delete(ctx context.Context, id, tenantID string) error

	ListMovements(ctx context.Context, stockItemID, tenantID string) ([]*domain.StockMovement, error)
	AddMovement(ctx context.Context, stockItemID, tenantID string, input CreateMovementInput) (*domain.StockMovement, error)
}

// Service implements the stock-item + movement use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) Create(ctx context.Context, input CreateStockItemInput, tenantID, branchID string) (*domain.StockItem, error) {
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	current := 0.0
	if input.CurrentQuantity != nil {
		current = *input.CurrentQuantity
	}
	low := 0.0
	if input.LowStockThreshold != nil {
		low = *input.LowStockThreshold
	}
	price := 0.0
	if input.PurchasePricePerUnit != nil {
		price = *input.PurchasePricePerUnit
	}
	item := &domain.StockItem{
		Name:                 input.Name,
		Unit:                 input.Unit,
		CurrentQuantity:      current,
		LowStockThreshold:    low,
		PurchasePricePerUnit: price,
		IsActive:             isActive,
		BranchID:             branchID,
	}
	if err := s.Repo.Create(ctx, item); err != nil {
		return nil, fmt.Errorf("creating stock item: %w", err)
	}
	return item, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*domain.StockItem, error) {
	item, err := s.Repo.FindByID(ctx, id, tenantID)
	if err != nil || item == nil {
		return nil, fmt.Errorf("stock item not found")
	}
	return item, nil
}

func (s *Service) List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.StockItem, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if !filter.All && (filter.Limit < 1 || filter.Limit > 200) {
		filter.Limit = 100
	}
	return s.Repo.List(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, item *domain.StockItem) error {
	return s.Repo.Update(ctx, item)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) error {
	return s.Repo.Delete(ctx, id, tenantID)
}

func (s *Service) ListMovements(ctx context.Context, stockItemID, tenantID string) ([]*domain.StockMovement, error) {
	return s.Repo.ListMovements(ctx, stockItemID, tenantID)
}

func (s *Service) AddMovement(ctx context.Context, stockItemID, tenantID string, input CreateMovementInput) (*domain.StockMovement, error) {
	if input.Type != domain.MovementIn && input.Type != domain.MovementOut && input.Type != domain.MovementAdjustment {
		return nil, apperror.NewValidation("invalid movement type")
	}
	if input.Quantity == 0 {
		return nil, apperror.NewValidation("quantity must be non-zero")
	}
	// IN/OUT are magnitudes — a negative value silently corrupts stock (an IN of
	// -5 subtracts and bypasses the OUT insufficient-stock guard entirely:
	// BUGS-E2E-FINDINGS #2). ADJUSTMENT may be signed, so it stays exempt.
	if input.Quantity < 0 && input.Type != domain.MovementAdjustment {
		return nil, apperror.NewValidation("quantity must be greater than zero")
	}
	return s.Repo.AddMovement(ctx, stockItemID, tenantID, input)
}
