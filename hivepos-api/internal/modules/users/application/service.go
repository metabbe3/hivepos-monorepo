package application

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/hivepos/api/internal/auth"
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
	Name        string   `json:"name"`
	Description *string  `json:"description,omitempty"`
	Color       *string  `json:"color,omitempty"`
	Permissions []string `json:"permissions"`
}

type UpdateRoleInput struct {
	Name        *string  `json:"name,omitempty"`
	Description *string  `json:"description,omitempty"`
	Color       *string  `json:"color,omitempty"`
	Permissions []string `json:"permissions,omitempty"`
}

// ListFilter paginates + filters the user/role list.
type ListFilter struct {
	BranchID string
	Search   string
	Role     string
	Page  int
	Limit int
	// All requests every row with no LIMIT/OFFSET — used by endpoints that are
	// unpaginated by design (e.g. /api/users, /api/roles — matches the TS contract).
	All bool
}

// Repository is the port for user/role persistence (hexagonal).
// RoleListItem mirrors the running TS /api/roles item: drops tenantId/updatedAt,
// adds userCount, and emits permissions as a JSON array.
type RoleListItem struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Color       *string   `json:"color"`
	Permissions []string  `json:"permissions"`
	IsSystem    bool      `json:"isSystem"`
	CreatedAt   time.Time `json:"createdAt"`
	UserCount   int64     `json:"userCount"`
}

// BranchRef / RoleRef are the nested objects on a UserListItem.
type BranchRef struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}
type RoleRef struct {
	ID    string  `json:"id"`
	Name  string  `json:"name"`
	Color *string `json:"color"`
}

// UserListItem mirrors the running TS /api/users item: drops
// isActive/sessionVersion/tenantId/updatedAt and adds nested branch + roleRef.
type UserListItem struct {
	ID        string     `json:"id"`
	Email     *string    `json:"email"`
	Name      string     `json:"name"`
	Phone     *string    `json:"phone"`
	Role      string     `json:"role"`
	RoleID    *string    `json:"roleId"`
	BranchID  string     `json:"branchId"`
	CreatedAt time.Time  `json:"createdAt"`
	Branch    *BranchRef `json:"branch"`
	RoleRef   *RoleRef   `json:"roleRef"`
}

type Repository interface {
	// Users
	CreateUser(ctx context.Context, u *domain.User) error
	FindUserByID(ctx context.Context, id, tenantID string) (*domain.User, error)
	ListUsers(ctx context.Context, tenantID string, f ListFilter) ([]*domain.User, int64, error)
	ListUserItems(ctx context.Context, tenantID string, f ListFilter) ([]*UserListItem, int64, error)
	UpdateUser(ctx context.Context, id, tenantID string, upd UpdateUserInput) error
	DeleteUser(ctx context.Context, id, tenantID string) error
	SetPIN(ctx context.Context, id, tenantID, pinHash string) error
	ResetUserPassword(ctx context.Context, id, tenantID, hashed string) error

	// Roles
	CreateRole(ctx context.Context, r *domain.Role) error
	FindRoleByID(ctx context.Context, id, tenantID string) (*domain.Role, error)
	GetRoleName(ctx context.Context, id, tenantID string) (string, error)
	ListRoles(ctx context.Context, tenantID string, f ListFilter) ([]*domain.Role, int64, error)
	ListRoleItems(ctx context.Context, tenantID string, f ListFilter) ([]*RoleListItem, int64, error)
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

	// Derive the system role enum (OWNER|MANAGER|EMPLOYEE) from the selected roleId's name.
	// The FE staff form only sends roleId (UUID); the role enum was hardcoded to EMPLOYEE.
	role := input.Role
	if role == "" && input.RoleID != nil && *input.RoleID != "" {
		roleName, err := s.Repo.GetRoleName(ctx, *input.RoleID, tenantID)
		if err == nil && roleName != "" {
			role = roleNametoEnum(roleName)
		}
	}
	if role == "" {
		role = "EMPLOYEE"
	}

	u := &domain.User{
		Email:    input.Email,
		Name:     input.Name,
		Phone:    input.Phone,
		Role:     role,
		RoleID:   input.RoleID,
		BranchID: input.BranchID,
		TenantID: tenantID,
		IsActive: true,
	}
	if input.IsActive != nil {
		u.IsActive = *input.IsActive
	}
	if input.Password != nil && *input.Password != "" {
		h, err := auth.HashPassword(*input.Password)
		if err != nil {
			return nil, fmt.Errorf("hashing password: %w", err)
		}
		u.PasswordHash = &h
	}
	if input.PIN != nil && *input.PIN != "" {
		if len(*input.PIN) < 4 {
			return nil, fmt.Errorf("pin must be at least 4 digits")
		}
		h, err := auth.HashPassword(*input.PIN)
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

func (s *Service) ListUserItems(ctx context.Context, tenantID string, f ListFilter) ([]*UserListItem, int64, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if !f.All && (f.Limit < 1 || f.Limit > 100) {
		f.Limit = 20
	}
	return s.Repo.ListUserItems(ctx, tenantID, f)
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
	h, err := auth.HashPassword(input.PIN)
	if err != nil {
		return fmt.Errorf("hashing pin: %w", err)
	}
	return s.Repo.SetPIN(ctx, id, tenantID, h)
}

// ResetUserPassword generates a one-time temp password, hashes it, stores it, and
// bumps the user's sessionVersion (invalidating their current session). Returns the
// plain temp so the owner can share it out-of-band. Tenant-scoped via the repo.
func (s *Service) ResetUserPassword(ctx context.Context, id, tenantID string) (string, error) {
	temp, err := genTempPassword(10)
	if err != nil {
		return "", fmt.Errorf("generating temp password: %w", err)
	}
	h, err := auth.HashPassword(temp)
	if err != nil {
		return "", fmt.Errorf("hashing password: %w", err)
	}
	if err := s.Repo.ResetUserPassword(ctx, id, tenantID, h); err != nil {
		return "", fmt.Errorf("resetting password: %w", err)
	}
	return temp, nil
}

// genTempPassword returns a crypto-random alphanumeric temp (no ambiguous chars:
// drops 0/O/1/l/I). Used for owner-initiated staff password resets.
const tempPassAlphabet = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func genTempPassword(n int) (string, error) {
	b := make([]byte, n)
	max := big.NewInt(int64(len(tempPassAlphabet)))
	for i := range b {
		v, err := rand.Int(rand.Reader, max)
		if err != nil {
			return "", err
		}
		b[i] = tempPassAlphabet[v.Int64()]
	}
	return string(b), nil
}

// --- Roles ---

func (s *Service) CreateRole(ctx context.Context, input CreateRoleInput, tenantID string) (*domain.Role, error) {
	if input.Name == "" {
		return nil, fmt.Errorf("name is required")
	}
	perms := input.Permissions
	if perms == nil {
		perms = []string{} // _text NOT NULL: never send a nil slice
	}
	color := input.Color
	if color == nil || *color == "" {
		def := "purple" // matches Role.color NOT NULL default
		color = &def
	}
	r := &domain.Role{
		Name:        input.Name,
		Description: input.Description,
		Color:       color,
		Permissions: perms,
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

func (s *Service) ListRoleItems(ctx context.Context, tenantID string, f ListFilter) ([]*RoleListItem, int64, error) {
	if f.Page < 1 {
		f.Page = 1
	}
	if !f.All && (f.Limit < 1 || f.Limit > 100) {
		f.Limit = 20
	}
	return s.Repo.ListRoleItems(ctx, tenantID, f)
}

func (s *Service) UpdateRole(ctx context.Context, id, tenantID string, upd UpdateRoleInput) error {
	return s.Repo.UpdateRole(ctx, id, tenantID, upd)
}

func (s *Service) DeleteRole(ctx context.Context, id, tenantID string) error {
	return s.Repo.DeleteRole(ctx, id, tenantID)
}

// roleNametoEnum maps a Role.name ("Owner", "Manager", "Kasir", "Staff") to the
// User.role enum (OWNER|MANAGER|EMPLOYEE). Case-insensitive prefix match.
func roleNametoEnum(name string) string {
	switch strings.ToUpper(name) {
	case "OWNER":
		return "OWNER"
	case "MANAGER":
		return "MANAGER"
	default:
		return "EMPLOYEE"
	}
}
