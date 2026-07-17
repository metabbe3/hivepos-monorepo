package domain

import "time"

// PricingType mirrors the Prisma enum.
type PricingType string

const (
	PerKg    PricingType = "PER_KG"
	PerItem  PricingType = "PER_ITEM"
	FlatRate PricingType = "FLAT"
)

// CommissionType mirrors the Prisma enum.
type CommissionType string

const (
	CommissionNone    CommissionType = "NONE"
	CommissionFlat    CommissionType = "FLAT"
	CommissionPercent CommissionType = "PERCENTAGE"
)

// Service is the priced service entity scoped to a branch + module.
type Service struct {
	ID              string         `json:"id"`
	Name            string         `json:"name"`
	Description     *string        `json:"description"`
	PricingType     PricingType    `json:"pricingType"`
	BasePrice       float64        `json:"basePrice"`
	CommissionType  CommissionType `json:"commissionType"`
	CommissionValue float64        `json:"commissionValue"`
	Module          string         `json:"module"`
	IsActive        bool           `json:"isActive"`
	IsDefaultSpeed  bool           `json:"isDefaultSpeed"`
	BranchID        string         `json:"branchId"`
	GroupID         *string        `json:"groupId"`
	CreatedAt       time.Time      `json:"createdAt"`
	UpdatedAt       time.Time      `json:"updatedAt"`
}

// ServiceGroup groups services within a branch + module (e.g. speed variants).
type ServiceGroup struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	SortOrder   int       `json:"sortOrder"`
	Module      string    `json:"module"`
	BranchID    string    `json:"branchId"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}
