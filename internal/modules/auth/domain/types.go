package domain

import "time"

// User is the domain entity for an authenticated account.
type User struct {
	ID             string    `json:"id"`
	Email          string    `json:"email"`
	Name           string    `json:"name"`
	PasswordHash   string    `json:"-"` // never serialized
	TenantID       string    `json:"tenantId"`
	BranchID       string    `json:"branchId"`
	Role           string    `json:"role"`
	SessionVersion int       `json:"sessionVersion"`
	CreatedAt      time.Time `json:"createdAt"`
}

// UserContext is the full context needed to mint a JWT: the user plus their
// tenant/branch/role lookup and resolved permissions/feature flags.
type UserContext struct {
	User
	TenantName   string            `json:"tenantName"`
	TenantSlug   string            `json:"tenantSlug"`
	BranchName   string            `json:"branchName"`
	Permissions  []string          `json:"permissions"`
	FeatureFlags map[string]bool   `json:"featureFlags"`
}

// RegisterInput is the body of POST /api/register.
type RegisterInput struct {
	TenantName string  `json:"tenantName"`
	TenantSlug string  `json:"tenantSlug"`
	OwnerName  string  `json:"ownerName"`
	Email      string  `json:"email"`
	Password   string  `json:"password"`
	Module     string  `json:"module"`
	BranchName string  `json:"branchName"`
	Phone      *string `json:"phone,omitempty"`
	GoogleID   string  `json:"googleId,omitempty"`
}

// LoginInput is the body of POST /api/auth/login.
type LoginInput struct {
	Email    string `json:"email"`
	Password string `json:"password"`
	// Scope gates which table authenticates: "super-admin" → "SuperAdmin" table
	// (platform staff), anything else → "User" table (tenant users). Mirrors the
	// legacy pos-saas NextAuth authorize() scope gate.
	Scope string `json:"scope"`
}

// UserInfo is the public projection of a user (no secrets).
type UserInfo struct {
	ID       string `json:"id"`
	Email    string `json:"email"`
	Name     string `json:"name"`
	Role     string `json:"role"`
	TenantID string `json:"tenantId"`
	BranchID string `json:"branchId"`
}

// LoginResponse is returned on successful login / registration.
type LoginResponse struct {
	Token string   `json:"token"`
	User  UserInfo `json:"user"`
}
