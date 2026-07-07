package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/customers/domain"
)

type CreateCustomerInput struct {
	Name     string  `json:"name"`
	Phone    *string `json:"phone"`
	Email    *string `json:"email"`
	Notes    *string `json:"notes"`
	ClientID *string `json:"clientId"`
}

type ListFilter struct {
	BranchID string
	Search   string
	Status   string
	Sort     string
	Order    string
	Page     int
	Limit    int
}

type Repository interface {
	Create(ctx context.Context, c *domain.Customer) error
	FindByID(ctx context.Context, id, tenantID string) (*domain.Customer, error)
	FindByPhone(ctx context.Context, phone, branchID string) (*domain.Customer, error)
	FindByClientID(ctx context.Context, clientID string) (*domain.Customer, error)
	List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Customer, int64, error)
	Update(ctx context.Context, c *domain.Customer) error
	Delete(ctx context.Context, id, tenantID string) error
	GetStats(ctx context.Context, id, tenantID string) (*domain.CustomerStats, error)
	GetDeposits(ctx context.Context, customerID, tenantID string) ([]*domain.DepositTransaction, error)
	TopUpDeposit(ctx context.Context, customerID, tenantID string, amount float64, tType, notes string) (*domain.DepositTransaction, error)
}

type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) Create(ctx context.Context, input CreateCustomerInput, tenantID, branchID string) (*domain.Customer, error) {
	if input.Phone != nil && *input.Phone != "" {
		existing, _ := s.Repo.FindByPhone(ctx, *input.Phone, branchID)
		if existing != nil {
			return nil, fmt.Errorf("customer with this phone already exists")
		}
	}
	if input.ClientID != nil {
		existing, _ := s.Repo.FindByClientID(ctx, *input.ClientID)
		if existing != nil {
			return existing, nil // idempotent
		}
	}
	c := &domain.Customer{Name: input.Name, Phone: input.Phone, Email: input.Email, Notes: input.Notes, BranchID: branchID}
	if err := s.Repo.Create(ctx, c); err != nil {
		return nil, fmt.Errorf("creating customer: %w", err)
	}
	return c, nil
}

func (s *Service) Get(ctx context.Context, id, tenantID string) (*domain.Customer, error) {
	c, err := s.Repo.FindByID(ctx, id, tenantID)
	if err != nil || c == nil {
		return nil, fmt.Errorf("customer not found")
	}
	return c, nil
}

func (s *Service) List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Customer, int64, error) {
	if filter.Page < 1 { filter.Page = 1 }
	if filter.Limit < 1 || filter.Limit > 100 { filter.Limit = 20 }
	return s.Repo.List(ctx, tenantID, filter)
}

func (s *Service) Update(ctx context.Context, c *domain.Customer) error {
	return s.Repo.Update(ctx, c)
}

func (s *Service) Delete(ctx context.Context, id, tenantID string) error {
	return s.Repo.Delete(ctx, id, tenantID)
}

func (s *Service) GetStats(ctx context.Context, id, tenantID string) (*domain.CustomerStats, error) {
	return s.Repo.GetStats(ctx, id, tenantID)
}

func (s *Service) GetDeposits(ctx context.Context, customerID, tenantID string) ([]*domain.DepositTransaction, error) {
	return s.Repo.GetDeposits(ctx, customerID, tenantID)
}

func (s *Service) TopUpDeposit(ctx context.Context, customerID, tenantID string, amount float64, tType, notes string) (*domain.DepositTransaction, error) {
	return s.Repo.TopUpDeposit(ctx, customerID, tenantID, amount, tType, notes)
}
