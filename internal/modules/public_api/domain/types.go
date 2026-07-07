package domain

import "time"

// TicketStatus mirrors the Prisma enum.
type TicketStatus string

const (
	TicketOpen    TicketStatus = "OPEN"
	TicketClosed  TicketStatus = "CLOSED"
	TicketPending TicketStatus = "PENDING"
)

// TicketPriority mirrors the Prisma enum.
type TicketPriority string

const (
	PriorityNormal TicketPriority = "NORMAL"
	PriorityHigh   TicketPriority = "HIGH"
	PriorityLow    TicketPriority = "LOW"
)

// PickupStatus mirrors the Prisma enum.
type PickupStatus string

const (
	PickupPending   PickupStatus = "PENDING"
	PickupAccepted  PickupStatus = "ACCEPTED"
	PickupScheduled PickupStatus = "SCHEDULED"
	PickupCanceled  PickupStatus = "CANCELED"
)

// PublicBranch is the public-facing branch view (no internal IDs leaked beyond the row id).
type PublicBranch struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	Address    string `json:"address"`
	Phone      string `json:"phone"`
	Hours      string `json:"hours"`
	TenantName string `json:"tenantName"`
}

// PublicService is the public-facing service catalog entry.
type PublicService struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Price       float64 `json:"price"`
	PricingType string  `json:"pricingType"`
	Duration    *int    `json:"duration,omitempty"`
}

// TicketInput is the DTO for creating a support ticket (tenantSlug optional).
type TicketInput struct {
	Name       string  `json:"name"`
	Email      string  `json:"email"`
	Subject    string  `json:"subject"`
	Message    string  `json:"message"`
	TenantSlug *string `json:"tenantSlug,omitempty"`
}

// SupportTicket is the persisted ticket entity.
type SupportTicket struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Email     string    `json:"email"`
	Subject   string    `json:"subject"`
	Message   string    `json:"message"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"createdAt"`
}

// PublicOrder is the public order-tracking view (no customer PII).
type PublicOrder struct {
	OrderNumber    string            `json:"orderNumber"`
	Status         string            `json:"status"`
	PaymentStatus  string            `json:"paymentStatus"`
	Items          []PublicOrderItem `json:"items"`
	EstimatedReady *time.Time        `json:"estimatedReady,omitempty"`
	CreatedAt      time.Time         `json:"createdAt"`
}

// PublicOrderItem is a line item within a tracked order.
type PublicOrderItem struct {
	Name     string  `json:"name"`
	Quantity float64 `json:"qty"`
	Subtotal float64 `json:"subtotal"`
}

// PickupInput is the DTO for creating a public pickup request.
type PickupInput struct {
	Name          string   `json:"name"`
	Phone         string   `json:"phone"`
	Address       string   `json:"address"`
	PreferredTime string   `json:"preferredTime"`
	Notes         string   `json:"notes"`
	TenantSlug    string   `json:"tenantSlug"`
	ServiceIDs    []string `json:"serviceIds"`
}

// PickupRequest is the persisted public pickup request.
type PickupRequest struct {
	ID            string    `json:"id"`
	Name          string    `json:"name"`
	Phone         string    `json:"phone"`
	Address       string    `json:"address"`
	PreferredTime string    `json:"preferredTime"`
	Notes         string    `json:"notes"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
}
