package application

import (
	"context"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/services/domain"
)

// CreateServiceInput is the DTO for creating a service.
type CreateServiceInput struct {
	Name            string                `json:"name"`
	Description     *string               `json:"description"`
	PricingType     domain.PricingType    `json:"pricingType"`
	BasePrice       float64               `json:"basePrice"`
	CommissionType  domain.CommissionType `json:"commissionType"`
	CommissionValue float64               `json:"commissionValue"`
	Module          string                `json:"module"`
	IsActive        *bool                 `json:"isActive"`
	IsDefaultSpeed  *bool                 `json:"isDefaultSpeed"`
	GroupID         *string               `json:"groupId"`
}

// CreateGroupInput is the DTO for creating a service group.
type CreateGroupInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	SortOrder   *int    `json:"sortOrder"`
	Module      string  `json:"module"`
}

// ListFilter holds the query params for listing services or groups.
type ListFilter struct {
	BranchID string
	Module   string
	Search   string
	Active   string
	GroupID  string
	Page     int
	Limit    int
	// All requests every row with no LIMIT/OFFSET — used by endpoints that are
	// unpaginated by design (e.g. /api/services, matching the original TS contract).
	All bool
}

// ServiceGroupRef is the nested group object on a ServiceListItem (null when
// the service has no group).
type ServiceGroupRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// ServiceListItem mirrors the running TS /api/services item: drops branchId and
// adds the nested group.
type ServiceListItem struct {
	ID              string                `json:"id"`
	Name            string                `json:"name"`
	Description     *string               `json:"description"`
	PricingType     domain.PricingType    `json:"pricingType"`
	BasePrice       float64               `json:"basePrice"`
	CommissionType  domain.CommissionType `json:"commissionType"`
	CommissionValue float64               `json:"commissionValue"`
	Module          string                `json:"module"`
	IsActive        bool                  `json:"isActive"`
	IsDefaultSpeed  bool                  `json:"isDefaultSpeed"`
	GroupID         *string               `json:"groupId"`
	CreatedAt       time.Time             `json:"createdAt"`
	UpdatedAt       time.Time             `json:"updatedAt"`
	Group           *ServiceGroupRef      `json:"group"`
}

// Repository is the persistence port for services + service groups.
type Repository interface {
	Create(ctx context.Context, s *domain.Service) error
	FindByID(ctx context.Context, id, tenantID string) (*domain.Service, error)
	List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Service, int64, error)
	ListItems(ctx context.Context, tenantID string, filter ListFilter) ([]*ServiceListItem, int64, error)
	Update(ctx context.Context, s *domain.Service) error
	Delete(ctx context.Context, id, tenantID string) error

	CreateGroup(ctx context.Context, g *domain.ServiceGroup) error
	FindGroupByID(ctx context.Context, id, tenantID string) (*domain.ServiceGroup, error)
	ListGroups(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.ServiceGroup, int64, error)
	UpdateGroup(ctx context.Context, g *domain.ServiceGroup) error
	DeleteGroup(ctx context.Context, id, tenantID string) error
}

// Service implements the service + service-group use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

// Create creates a new service scoped to a branch.
func (s *Service) Create(ctx context.Context, input CreateServiceInput, tenantID, branchID string) (*domain.Service, error) {
	if input.PricingType == "" {
		input.PricingType = domain.PerKg
	}
	if input.CommissionType == "" {
		input.CommissionType = domain.CommissionNone
	}
	if input.Module == "" {
		input.Module = "LAUNDRY"
	}
	isActive := true
	if input.IsActive != nil {
		isActive = *input.IsActive
	}
	svc := &domain.Service{
		Name:            input.Name,
		Description:     input.Description,
		PricingType:     input.PricingType,
		BasePrice:       input.BasePrice,
		CommissionType:  input.CommissionType,
		CommissionValue: input.CommissionValue,
		Module:          input.Module,
		IsActive:        isActive,
		IsDefaultSpeed:  input.IsDefaultSpeed != nil && *input.IsDefaultSpeed,
		BranchID:        branchID,
		GroupID:         input.GroupID,
	}
	if err := s.Repo.Create(ctx, svc); err != nil {
		return nil, fmt.Errorf("creating service: %w", err)
	}
	return svc, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*domain.Service, error) {
	svc, err := s.Repo.FindByID(ctx, id, tenantID)
	if err != nil || svc == nil {
		return nil, fmt.Errorf("service not found")
	}
	return svc, nil
}

func (s *Service) List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Service, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if !filter.All && (filter.Limit < 1 || filter.Limit > 200) {
		filter.Limit = 100
	}
	return s.Repo.List(ctx, tenantID, filter)
}

// ListItems returns the curated ServiceListItem DTO (matches TS /api/services).
func (s *Service) ListItems(ctx context.Context, tenantID string, filter ListFilter) ([]*ServiceListItem, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if !filter.All && (filter.Limit < 1 || filter.Limit > 200) {
		filter.Limit = 100
	}
	return s.Repo.ListItems(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, svc *domain.Service) error {
	return s.Repo.Update(ctx, svc)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) error {
	return s.Repo.Delete(ctx, id, tenantID)
}

// CreateGroup creates a new service group scoped to a branch.
func (s *Service) CreateGroup(ctx context.Context, input CreateGroupInput, tenantID, branchID string) (*domain.ServiceGroup, error) {
	if input.Module == "" {
		input.Module = "LAUNDRY"
	}
	sortOrder := 0
	if input.SortOrder != nil {
		sortOrder = *input.SortOrder
	}
	g := &domain.ServiceGroup{
		Name:        input.Name,
		Description: input.Description,
		SortOrder:   sortOrder,
		Module:      input.Module,
		BranchID:    branchID,
	}
	if err := s.Repo.CreateGroup(ctx, g); err != nil {
		return nil, fmt.Errorf("creating service group: %w", err)
	}
	return g, nil
}

func (s *Service) GetGroup(ctx context.Context, id, tenantID string) (*domain.ServiceGroup, error) {
	g, err := s.Repo.FindGroupByID(ctx, id, tenantID)
	if err != nil || g == nil {
		return nil, fmt.Errorf("service group not found")
	}
	return g, nil
}

func (s *Service) ListGroups(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.ServiceGroup, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 100
	}
	return s.Repo.ListGroups(ctx, tenantID, filter)
}

func (s *Service) UpdateGroup(ctx context.Context, g *domain.ServiceGroup) error {
	return s.Repo.UpdateGroup(ctx, g)
}

func (s *Service) DeleteGroup(ctx context.Context, id, tenantID string) error {
	return s.Repo.DeleteGroup(ctx, id, tenantID)
}
