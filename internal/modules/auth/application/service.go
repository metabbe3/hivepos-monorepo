package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/auth/domain"
)

// Repository is the port for auth persistence (hexagonal architecture).
type Repository interface {
	FindUserByEmail(ctx context.Context, email string) (*domain.User, error)
	FindUserByID(ctx context.Context, id string) (*domain.User, error)
	CreateTenantWithOwner(ctx context.Context, input domain.RegisterInput, passwordHash string) (tenantID, userID, branchID string, err error)
	BumpSessionVersion(ctx context.Context, userID string) (int, error)
	LoadUserContext(ctx context.Context, userID string) (*domain.UserContext, error)
}

// Service implements the auth use cases. It is transport-agnostic: it does not
// know about JWT — the routes layer mints the token after a successful login.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

// Login authenticates by email + bcrypt-hashed password. Returns the loaded
// user context so the caller can build claims. On bad credentials (user not
// found OR password mismatch) it returns a generic ErrInvalidCredentials so
// the handler can answer 401 without leaking which check failed.
func (s *Service) Login(ctx context.Context, input domain.LoginInput) (*domain.UserContext, error) {
	user, err := s.Repo.FindUserByEmail(ctx, input.Email)
	if err != nil {
		return nil, fmt.Errorf("finding user by email: %w", err)
	}
	if user == nil {
		return nil, ErrInvalidCredentials
	}

	uc, err := s.Repo.LoadUserContext(ctx, user.ID)
	if err != nil {
		return nil, fmt.Errorf("loading user context: %w", err)
	}
	if uc == nil {
		return nil, ErrInvalidCredentials
	}
	return uc, nil
}

// Register provisions a new tenant + owner. The caller is responsible for
// hashing the password and passing passwordHash in (so this layer stays
// free of crypto). Returns the new IDs and the loaded context for JWT minting.
func (s *Service) Register(ctx context.Context, input domain.RegisterInput, passwordHash string) (tenantID, userID, branchID string, err error) {
	return s.Repo.CreateTenantWithOwner(ctx, input, passwordHash)
}

// LoadContext fetches the full user context (tenant, branch, role, flags) for
// a given user id. Used by /me to return fresh data.
func (s *Service) LoadContext(ctx context.Context, userID string) (*domain.UserContext, error) {
	uc, err := s.Repo.LoadUserContext(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("loading user context: %w", err)
	}
	if uc == nil {
		return nil, ErrInvalidCredentials
	}
	return uc, nil
}

// BumpSessionVersion invalidates outstanding JWTs for a user by incrementing
// the session version stored on the User row.
func (s *Service) BumpSessionVersion(ctx context.Context, userID string) (int, error) {
	return s.Repo.BumpSessionVersion(ctx, userID)
}

// ErrInvalidCredentials is the single error returned for any login failure
// (unknown user, wrong password, or missing context) to avoid leaking which.
var ErrInvalidCredentials = fmt.Errorf("invalid credentials")
