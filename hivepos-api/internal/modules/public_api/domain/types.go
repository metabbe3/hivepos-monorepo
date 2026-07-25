package domain

import (
	"encoding/json"
	"time"
)

// PublicTenant is the public website payload: tenant identity + settings (which carries
// the dashboard `website` block: tagline/about/hero/instagram/qris/google/…) + the branch
// directory with geo/contact/link fields the public site renders.
type PublicTenant struct {
	ID           string          `json:"id"`
	Name         string          `json:"name"`
	Slug         string          `json:"slug"`
	LogoURL      *string         `json:"logoUrl"`
	Settings     json.RawMessage `json:"settings"`
	Branches     []PublicTenantBranch `json:"branches"`
}

// PublicTenantBranch is the rich public branch view (geo + contact + links + hours) used by
// the tenant-site primaryBranch render.
type PublicTenantBranch struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Address         *string         `json:"address"`
	Phone           *string         `json:"phone"`
	Slug            *string         `json:"slug"`
	Latitude        *float64        `json:"latitude"`
	Longitude       *float64        `json:"longitude"`
	GoogleMapsLink  *string         `json:"googleMapsLink"`
	WhatsAppLink    *string         `json:"whatsappLink"`
	OperatingHours  json.RawMessage `json:"operatingHours"`
}

// PublicTenantSummary is the directory-listing view of an active tenant with a published
// public website — drives the /laundry city directory + the sitemap tenant URLs. Carries
// the primary branch address (free-text) so the FE can group by city; there is no
// structured city column (schema changes are Prisma-only, out of Go scope).
type PublicTenantSummary struct {
	Slug               string  `json:"slug"`
	Name               string  `json:"name"`
	Address            *string `json:"address"`
	WebsitePublishedAt *string `json:"websitePublishedAt"`
}

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
	ID             string   `json:"id"`
	Slug           string   `json:"slug"`
	Name           string   `json:"name"`
	Address        string   `json:"address"`
	Phone          string   `json:"phone"`
	OperatingHours string   `json:"operatingHours"`
	Latitude       *float64 `json:"latitude,omitempty"`
	Longitude      *float64 `json:"longitude,omitempty"`
	WhatsappLink   string   `json:"whatsappLink"`
	GoogleMapsLink string   `json:"googleMapsLink"`
	TenantName     string   `json:"tenantName"`
}

// PublicService is the public-facing service catalog entry.
type PublicService struct {
	ID          string              `json:"id"`
	Name        string              `json:"name"`
	Description string              `json:"description"`
	Price       float64             `json:"price"`
	PricingType string              `json:"pricingType"`
	Duration    *int                `json:"duration,omitempty"`
	Group       *PublicServiceGroup `json:"group,omitempty"`
}

// PublicServiceGroup is the (optional) service-group category on a public catalog entry.
type PublicServiceGroup struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// PublicBlogPost is the public blog view — internal fields (id, published, authorId,
// timestamps) are stripped. Matches the FE BlogPost interface + openapi contract.
type PublicBlogPost struct {
	Slug        string     `json:"slug"`
	Title       string     `json:"title"`
	Description string     `json:"description"`
	Keywords    *string    `json:"keywords"`
	Content     string     `json:"content"`
	CoverImage  *string    `json:"coverImage"`
	PublishedAt *time.Time `json:"publishedAt"`
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
	Email         string   `json:"customerEmail,omitempty"`
	Address       string   `json:"address"`
	PreferredTime string   `json:"preferredTime"`
	Notes         string   `json:"notes"`
	TenantSlug    string   `json:"tenantSlug"`
	ServiceIDs    []string `json:"serviceIds"`
	Latitude      *float64 `json:"latitude,omitempty"`
	Longitude     *float64 `json:"longitude,omitempty"`
	MapsLink      string   `json:"mapsLink,omitempty"`
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
