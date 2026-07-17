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
	GetSessionVersion(ctx context.Context, userID string) (int, error)
	LoadUserContext(ctx context.Context, userID string) (*domain.UserContext, error)
	// Platform-staff (super-admin) auth — separate "SuperAdmin" table.
	FindSuperAdminByEmail(ctx context.Context, email string) (*domain.UserContext, error)
	LoadSuperAdminContext(ctx context.Context, id string) (*domain.UserContext, error)
	// Google OAuth.
	FindUserByGoogleID(ctx context.Context, googleID string) (*domain.User, error)
	SetUserGoogleID(ctx context.Context, userID, googleID, avatar string) error
	ClearUserGoogleID(ctx context.Context, userID string) error
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

// LoginSuperAdmin authenticates a platform-staff account against the SuperAdmin
// table (scope="super-admin" login path). Returns the context for JWT minting;
// not-found collapses into ErrInvalidCredentials like Login.
func (s *Service) LoginSuperAdmin(ctx context.Context, input domain.LoginInput) (*domain.UserContext, error) {
	uc, err := s.Repo.FindSuperAdminByEmail(ctx, input.Email)
	if err != nil {
		return nil, fmt.Errorf("finding super-admin by email: %w", err)
	}
	if uc == nil {
		return nil, ErrInvalidCredentials
	}
	return uc, nil
}

// LoadContextForRole routes /me to the right table by role: platform staff
// (SUPER_ADMIN/SUPPORT) load from SuperAdmin, everyone else from User.
func (s *Service) LoadContextForRole(ctx context.Context, userID, role string) (*domain.UserContext, error) {
	if role == "SUPER_ADMIN" || role == "SUPPORT" {
		uc, err := s.Repo.LoadSuperAdminContext(ctx, userID)
		if err != nil {
			return nil, fmt.Errorf("loading super-admin context: %w", err)
		}
		if uc == nil {
			return nil, ErrInvalidCredentials
		}
		return uc, nil
	}
	return s.LoadContext(ctx, userID)
}

// BumpSessionVersion invalidates outstanding JWTs for a user by incrementing
// the session version stored on the User row.
func (s *Service) BumpSessionVersion(ctx context.Context, userID string) (int, error) {
	return s.Repo.BumpSessionVersion(ctx, userID)
}

// GetSessionVersion returns the user's current sessionVersion (no mutation).
// GET /session-version uses this so the web's useSessionSync can detect
// admin-triggered permission reloads without the 405 it got from POST-only.
func (s *Service) GetSessionVersion(ctx context.Context, userID string) (int, error) {
	return s.Repo.GetSessionVersion(ctx, userID)
}

// ErrGoogleUserNotFound signals a Google identity with no matching local user —
// the handler redirects to /register so the visitor signs up first.
var ErrGoogleUserNotFound = fmt.Errorf("google user not found")

// GoogleLogin resolves a Google identity (email + googleID) to a UserContext for
// JWT minting. Order: existing googleId link → email match (link on first login)
// → not found. Returns ErrGoogleUserNotFound when no local account matches.
func (s *Service) GoogleLogin(ctx context.Context, email, googleID, avatar string) (*domain.UserContext, error) {
	if email == "" || googleID == "" {
		return nil, fmt.Errorf("missing google identity")
	}
	u, err := s.Repo.FindUserByGoogleID(ctx, googleID)
	if err != nil {
		return nil, fmt.Errorf("google login (by googleId): %w", err)
	}
	if u != nil {
		return s.LoadContext(ctx, u.ID)
	}
	u, err = s.Repo.FindUserByEmail(ctx, email)
	if err != nil {
		return nil, fmt.Errorf("google login (by email): %w", err)
	}
	if u != nil {
		// First Google login for a known email → link the googleId (best-effort).
		if linkErr := s.Repo.SetUserGoogleID(ctx, u.ID, googleID, avatar); linkErr != nil {
			return nil, fmt.Errorf("google login (link): %w", linkErr)
		}
		return s.LoadContext(ctx, u.ID)
	}
	return nil, ErrGoogleUserNotFound
}

// SetGoogle links a Google identity to a specific user (profile-link flow).
func (s *Service) SetGoogle(ctx context.Context, userID, googleID, avatar string) error {
	return s.Repo.SetUserGoogleID(ctx, userID, googleID, avatar)
}

// ClearGoogleID removes the Google link from a user (profile-unlink flow).
func (s *Service) ClearGoogleID(ctx context.Context, userID string) error {
	return s.Repo.ClearUserGoogleID(ctx, userID)
}

// ErrInvalidCredentials is the single error returned for any login failure
// (unknown user, wrong password, or missing context) to avoid leaking which.
var ErrInvalidCredentials = fmt.Errorf("invalid credentials")
