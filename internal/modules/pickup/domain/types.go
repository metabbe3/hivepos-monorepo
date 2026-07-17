package domain

import "time"

// PickupStatus mirrors the Prisma enum.
type PickupStatus string

const (
	PickupPending   PickupStatus = "PENDING"
	PickupAccepted  PickupStatus = "ACCEPTED"
	PickupRejected  PickupStatus = "REJECTED"
	PickupScheduled PickupStatus = "SCHEDULED"
	PickupAssigned  PickupStatus = "ASSIGNED"
	PickupConverted PickupStatus = "CONVERTED"
	PickupCanceled  PickupStatus = "CANCELED"
)

// PickupRequest is the domain entity.
type PickupRequest struct {
	ID               string       `json:"id"`
	TenantID         string       `json:"tenantId"`
	BranchID         string       `json:"branchId"`
	Status           PickupStatus `json:"status"`
	CustomerName     string       `json:"customerName"`
	CustomerPhone    *string      `json:"customerPhone,omitempty"`
	CustomerID       *string      `json:"customerId,omitempty"`
	Address          *string      `json:"address,omitempty"`
	RequestedDate    *time.Time   `json:"requestedDate,omitempty"`
	RequestedSlot    *string      `json:"requestedSlot,omitempty"`
	Notes            *string      `json:"notes,omitempty"`
	ConvertedOrderID *string      `json:"convertedOrderId,omitempty"`
	CreatedAt        time.Time    `json:"createdAt"`
	UpdatedAt        time.Time    `json:"updatedAt"`
}
