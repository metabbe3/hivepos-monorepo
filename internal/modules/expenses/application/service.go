package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/expenses/domain"
)

// CreateExpenseInput is the DTO for creating an expense.
type CreateExpenseInput struct {
	Amount      float64 `json:"amount"`
	Description *string `json:"description"`
	Date        *string `json:"date"`
	CategoryID  *string `json:"categoryId"`
}

// CreateCategoryInput is the DTO for creating an expense category.
type CreateCategoryInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

// ListFilter holds the query params for listing expenses.
type ListFilter struct {
	BranchID   string
	CategoryID string
	From       string
	To         string
	Search     string
	Page       int
	Limit      int
}

// CategoryListFilter holds the query params for listing categories.
type CategoryListFilter struct {
	BranchID string
	Search   string
	Page     int
	Limit    int
}

// Repository is the persistence port for expenses + categories.
type Repository interface {
	CreateExpense(ctx context.Context, e *domain.Expense) error
	FindExpenseByID(ctx context.Context, id, tenantID string) (*domain.Expense, error)
	ListExpenses(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Expense, int64, error)
	UpdateExpense(ctx context.Context, e *domain.Expense) error
	DeleteExpense(ctx context.Context, id, tenantID string) error

	CreateCategory(ctx context.Context, c *domain.ExpenseCategory) error
	FindCategoryByID(ctx context.Context, id, tenantID string) (*domain.ExpenseCategory, error)
	ListCategories(ctx context.Context, tenantID string, filter CategoryListFilter) ([]*domain.ExpenseCategory, int64, error)
	UpdateCategory(ctx context.Context, c *domain.ExpenseCategory) error
	DeleteCategory(ctx context.Context, id, tenantID string) error
}

// Service implements the expense + category use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) CreateExpense(ctx context.Context, input CreateExpenseInput, tenantID, branchID string) (*domain.Expense, error) {
	e := &domain.Expense{
		Amount:      input.Amount,
		Description: input.Description,
		BranchID:    branchID,
		CategoryID:  input.CategoryID,
	}
	if err := s.Repo.CreateExpense(ctx, e); err != nil {
		return nil, fmt.Errorf("creating expense: %w", err)
	}
	return e, nil
}

func (s *Service) GetExpense(ctx context.Context, id, tenantID string) (*domain.Expense, error) {
	e, err := s.Repo.FindExpenseByID(ctx, id, tenantID)
	if err != nil || e == nil {
		return nil, fmt.Errorf("expense not found")
	}
	return e, nil
}

func (s *Service) ListExpenses(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Expense, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 100
	}
	return s.Repo.ListExpenses(ctx, tenantID, filter)
}

func (s *Service) UpdateExpense(ctx context.Context, e *domain.Expense) error {
	return s.Repo.UpdateExpense(ctx, e)
}

func (s *Service) DeleteExpense(ctx context.Context, id, tenantID string) error {
	return s.Repo.DeleteExpense(ctx, id, tenantID)
}

func (s *Service) CreateCategory(ctx context.Context, input CreateCategoryInput, tenantID, branchID string) (*domain.ExpenseCategory, error) {
	c := &domain.ExpenseCategory{
		Name:        input.Name,
		Description: input.Description,
		BranchID:    branchID,
	}
	if err := s.Repo.CreateCategory(ctx, c); err != nil {
		return nil, fmt.Errorf("creating expense category: %w", err)
	}
	return c, nil
}

func (s *Service) GetCategory(ctx context.Context, id, tenantID string) (*domain.ExpenseCategory, error) {
	c, err := s.Repo.FindCategoryByID(ctx, id, tenantID)
	if err != nil || c == nil {
		return nil, fmt.Errorf("expense category not found")
	}
	return c, nil
}

func (s *Service) ListCategories(ctx context.Context, tenantID string, filter CategoryListFilter) ([]*domain.ExpenseCategory, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 200 {
		filter.Limit = 100
	}
	return s.Repo.ListCategories(ctx, tenantID, filter)
}

func (s *Service) UpdateCategory(ctx context.Context, c *domain.ExpenseCategory) error {
	return s.Repo.UpdateCategory(ctx, c)
}

func (s *Service) DeleteCategory(ctx context.Context, id, tenantID string) error {
	return s.Repo.DeleteCategory(ctx, id, tenantID)
}
