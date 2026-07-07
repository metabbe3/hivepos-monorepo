package domain

import "time"

// User is the domain entity. Mirrors the Prisma "User" model.
type User struct {
	ID             string    `json:"id"`
	Email          *string   `json:"email,omitempty"`
	PasswordHash   *string   `json:"-"` // never serialized
	Name           string    `json:"name"`
	Phone          *string   `json:"phone,omitempty"`
	Role           string    `json:"role"`
	RoleID         *string   `json:"roleId,omitempty"`
	TenantID       string    `json:"tenantId"`
	BranchID       string    `json:"branchId"`
	SessionVersion int       `json:"sessionVersion"`
	IsActive       bool      `json:"isActive"`
	PinHash        *string   `json:"-"` // never serialized
	QrToken        *string   `json:"qrToken,omitempty"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// Role is the RBAC role entity. Mirrors the Prisma "Role" model.
type Role struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description,omitempty"`
	IsSystem    bool      `json:"isSystem"`
	Color       *string   `json:"color,omitempty"`
	Permissions string    `json:"permissions"` // JSON string of permission array
	TenantID    string    `json:"tenantId"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
