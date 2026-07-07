package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/users/domain"
)

// --- User inputs ---

type CreateUserInput struct {
	Email    *string `json:"email,omitempty"`
	Password *string `json:"password,omitempty"`
	Name     string  `json:"name"`
	Phone    *string `json:"phone,omitempty"`
	Role     string  `json:"role"`
	RoleID   *string `json:"roleId,omitempty"`
	BranchID string  `json:"branchId"`
	PIN      *string `json:"pin,omitempty"`
	IsActive *bool   `json:"isActive,omitempty"`
}

type UpdateUserInput struct {
	Email    *string `json:"email,omitempty"`
	Name     *string `json:"name,omitempty"`
	Phone    *string `json:"phone,omitempty"`
	Role     *string `json:"role,omitempty"`
	RoleID   *string `json:"roleId,omitempty"`
	BranchID *string `json:"branchId,omitempty"`
	IsActive *bool   `json:"isActive,omitempty"`
}

type SetPINInput struct {
	PIN string `json:"pin"`
}

// --- Role inputs ---

type CreateRoleInput struct {
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	Color       *string `json:"color,omitempty"`
	Permissions string  `json:"permissions"`
}

type UpdateRoleInput struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Color       *string `json:"color,omitempty"`
	Permissions *string `json:"permissions,omitempty"`
}

// ListFilter paginates + filters the user/role list.
type ListFilter struct {
	BranchID string
	Search   string
	Role     string
	Page     int
	Limit    int
}

// Repository is the port for user/role persistence (hexagonal).
type Repository interface {
	// Users
	CreateUser(ctx context.Context, u *domain.User) error
	FindUserByID(ctx context.Context, id, tenantID string) (*domain.User, error)
	ListUsers(ctx context.Context, tenantID string, f ListFilter) ([]*domain.User, int64, error)
	UpdateUser(ctx context.Context, id, tenantID string, upd UpdateUserInput) error
	DeleteUser(ctx context.Context, id, tenantID string) error
	SetPIN(ctx context.Context, id, tenantID, pinHash string) error

	// Roles
	CreateRole(ctx context.Context, r *domain.Role) error
	FindRoleByID(ctx context.Context, id, tenantID string) (*domain.Role, error)
	ListRoles(ctx context.Context, tenantID string, f ListFilter) ([]*domain.Role, int64, error)
	UpdateRole(ctx context.Context, id, tenantID string, upd UpdateRoleInput) error
	DeleteRole(ctx context.Context, id, tenantID string) error
}

// Service implements the user/role use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

// --- Users ---

func (s *Service) CreateUser(ctx context.Context, input CreateUserInput, tenantID string) (*domain.User, error) {
	if input.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	u := &domain.User{
		Email:    input.Email,
		Name:     input.Name,
		Phone:    input.Phone,
		Role:     input.Role,
		RoleID:   input.RoleID,
		BranchID: input.BranchID,
		TenantID: tenantID,
		IsActive: true,
	}
	if input.IsActive != nil {
		u.IsActive = *input.IsActive
	}
	if input.Password != nil && *input.Password != "" {
		h, err := hashPassword(*input.Password)
		if err != nil {
			return nil, fmt.Errorf("hashing password: %w", err)
		}
		u.PasswordHash = &h
	}
	if input.PIN != nil && *input.PIN != "" {
		if len(*input.PIN) < 4 {
			return nil, fmt.Errorf("pin must be at least 4 digits")
		}
		h, err := hashPassword(*input.PIN)
		if err != nil {
			return nil, fmt.Errorf("hashing pin: %w", err)
		}
		u.PinHash = &h
	}
	if err := s.Repo.CreateUser(ctx, u); err != nil {
		return nil, fmt.Errorf("creating user: %w", err)
	}
	return u, nil
}

func (s *Service) GetUser(ctx context.Context, id, tenantID string) (*domain.User, error) {
	u, err := s.Repo.FindUserByID(ctx, id, tenantID)
	if err != nil || u == nil {
		return nil, fmt.Errorf("user not found")
	}
	return u, nil
}

func (s *Service) ListUsers(ctx context.Context, tenantID string, f ListFilter) ([]*domain.User, int64, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	return s.Repo.ListUsers(ctx, tenantID, f)
}

func (s *Service) UpdateUser(ctx context.Context, id, tenantID string, upd UpdateUserInput) error {
	return s.Repo.UpdateUser(ctx, id, tenantID, upd)
}

func (s *Service) DeleteUser(ctx context.Context, id, tenantID string) error {
	return s.Repo.DeleteUser(ctx, id, tenantID)
}

// SetPIN hashes and stores a new PIN for a user.
func (s *Service) SetPIN(ctx context.Context, id, tenantID string, input SetPINInput) error {
	if len(input.PIN) < 4 {
		return fmt.Errorf("pin must be at least 4 digits")
	}
	h, err := hashPassword(input.PIN)
	if err != nil {
		return fmt.Errorf("hashing pin: %w", err)
	}
	return s.Repo.SetPIN(ctx, id, tenantID, h)
}

// --- Roles ---

func (s *Service) CreateRole(ctx context.Context, input CreateRoleInput, tenantID string) (*domain.Role, error) {
	if input.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	if input.Permissions == "" {
		input.Permissions = "[]"
	}
	r := &domain.Role{
		Name:        input.Name,
		Description: input.Description,
		Color:       input.Color,
		Permissions: input.Permissions,
		TenantID:    tenantID,
	}
	if err := s.Repo.CreateRole(ctx, r); err != nil {
		return nil, fmt.Errorf("creating role: %w", err)
	}
	return r, nil
}

func (s *Service) GetRole(ctx context.Context, id, tenantID string) (*domain.Role, error) {
	r, err := s.Repo.FindRoleByID(ctx, id, tenantID)
	if err != nil || r == nil {
		return nil, fmt.Errorf("role not found")
	}
	return r, nil
}

func (s *Service) ListRoles(ctx context.Context, tenantID string, f ListFilter) ([]*domain.Role, int64, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Limit < 1 || f.Limit > 100 {
		f.Limit = 20
	}
	return s.Repo.ListRoles(ctx, tenantID, f)
}

func (s *Service) UpdateRole(ctx context.Context, id, tenantID string, upd UpdateRoleInput) error {
	return s.Repo.UpdateRole(ctx, id, tenantID, upd)
}

func (s *Service) DeleteRole(ctx context.Context, id, tenantID string) error {
	return s.Repo.DeleteRole(ctx, id, tenantID)
}
