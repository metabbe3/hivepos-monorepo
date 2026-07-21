package application

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hivepos/api/internal/modules/orders/domain"
)

// OrderDetail is the rich GET /api/orders/[id] shape the web's order detail,
// receipt, and edit pages consume (items + customer + payments + branch fields).
type OrderDetail struct {
	ID               string             `json:"id"`
	OrderNumber      string             `json:"orderNumber"`
	Status           string             `json:"status"`
	TotalAmount      float64            `json:"totalAmount"`
	DiscountAmount   float64            `json:"discountAmount"`
	DiscountType     *string            `json:"discountType"`
	PaidAmount       float64            `json:"paidAmount"`
	PaymentStatus    string             `json:"paymentStatus"`
	Notes            *string            `json:"notes"`
	CreatedAt        string             `json:"createdAt"`
	ReceivedAt       *string            `json:"receivedAt"`
	InProgressAt     *string            `json:"inProgressAt"`
	ReadyAt          *string            `json:"readyAt"`
	DeliveredAt      *string            `json:"deliveredAt"`
	CustomerID       string             `json:"customerId"`
	CustomerName     string             `json:"customerName"`
	CustomerPhone    *string            `json:"customerPhone"`
	CustomerBalance  float64            `json:"customerBalance"`
	QrisUrl          *string            `json:"qrisUrl"`
	InvoiceFooter    *string            `json:"invoiceFooter"`
	PrinterPaperSize *string            `json:"printerPaperSize"`
	OrderItems       []OrderItemDetail  `json:"orderItems"`
	Payments         []OrderPaymentDetail `json:"payments"`
}

type OrderItemDetail struct {
	ID                string          `json:"id"`
	ServiceID         string          `json:"serviceId"`
	ServiceName       string          `json:"serviceName"`
	Quantity          float64         `json:"quantity"`
	WeightKg          *float64        `json:"weightKg"`
	PricePerUnit      float64         `json:"pricePerUnit"`
	Subtotal          float64         `json:"subtotal"`
	Notes             *string         `json:"notes"`
	GarmentBreakdown  json.RawMessage `json:"garmentBreakdown"`
}

type OrderPaymentDetail struct {
	ID            string  `json:"id"`
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"paymentMethod"`
	Notes         *string `json:"notes"`
	PaidAt        string  `json:"paidAt"`
}

// CreateOrderInput mirrors the TS CreateOrderInput DTO.
type CreateOrderInput struct {
	CustomerID     string           `json:"customerId"`
	Items          []OrderItemInput `json:"items"`
	Notes          string           `json:"notes,omitempty"`
	DiscountType   string           `json:"discountType,omitempty"`
	DiscountAmount float64          `json:"discountAmount,omitempty"`
	ReceivedAt     *string          `json:"receivedAt,omitempty"`
}

type OrderItemInput struct {
	ServiceID        string          `json:"serviceId"`
	Quantity         float64         `json:"quantity"`
	WeightKg         *float64        `json:"weightKg,omitempty"`
	GarmentBreakdown json.RawMessage `json:"garmentBreakdown,omitempty"`
}

// UpdateOrderInput mirrors the TS PUT /api/orders/[id] edit payload.
type UpdateOrderInput struct {
	CustomerID     string           `json:"customerId"`
	Notes          string           `json:"notes"`
	ReceivedAt     *string          `json:"receivedAt"`
	DiscountType   string           `json:"discountType"`
	DiscountAmount float64          `json:"discountAmount"`
	Items          []OrderItemInput `json:"items"`
}

// Repository is the port for order persistence (hexagonal architecture).
type Repository interface {
	Create(ctx context.Context, order *domain.Order, items []domain.OrderItem) error
	FindByID(ctx context.Context, id, tenantID string) (*domain.Order, error)
	FindDetailByID(ctx context.Context, id, tenantID string) (*OrderDetail, error)
	FindByClientID(ctx context.Context, clientID string) (*domain.Order, error)
	List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Order, int64, error)
	ListItems(ctx context.Context, tenantID string, filter ListFilter) ([]*OrderListItem, int64, error)
	UpdateStatus(ctx context.Context, id, tenantID string, status domain.OrderStatus) error
	Update(ctx context.Context, id, tenantID string, in UpdateOrderInput) (*domain.Order, error)
	RecordPayment(ctx context.Context, id, tenantID string, amount float64, method, notes string, paidAt *time.Time) (*domain.Order, error)
	VoidPayment(ctx context.Context, tenantID, orderID, paymentID string) (*domain.Order, error)
	Delete(ctx context.Context, id, tenantID string) error
}

type ListFilter struct {
	BranchID      string
	Status        string
	Search        string
	PaymentStatus string
	DateFrom      string
	DateTo        string
	SortBy        string
	SortOrder     string
	Page          int
	Limit         int
}

// OrderListItem mirrors the running TS /api/orders list item shape for a user
// that can see financials (OWNER/SUPER_ADMIN). Customer fields are flattened
// (customerName/customerPhone), matching the deployed backend.
type OrderListItem struct {
	ID             string               `json:"id"`
	OrderNumber    string               `json:"orderNumber"`
	CustomerID     string               `json:"customerId"`
	CustomerName   string               `json:"customerName"`
	CustomerPhone  *string              `json:"customerPhone"`
	Status         domain.OrderStatus   `json:"status"`
	Module         string               `json:"module"`
	TotalAmount    float64              `json:"totalAmount"`
	PaidAmount     float64              `json:"paidAmount"`
	DiscountAmount float64              `json:"discountAmount"`
	DiscountType   *string              `json:"discountType"`
	PaymentStatus  domain.PaymentStatus `json:"paymentStatus"`
	Notes          *string              `json:"notes"`
	ReceivedAt     *time.Time           `json:"receivedAt"`
	CreatedAt      time.Time            `json:"createdAt"`
	UpdatedAt      time.Time            `json:"updatedAt"`
}

// Service implements the order use cases.
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

// Create creates a new order (idempotent via ClientID).
func (s *Service) Create(ctx context.Context, input CreateOrderInput, tenantID, branchID, userID string, clientID *string) (*domain.Order, error) {
	// Idempotency check
	if clientID != nil {
		existing, err := s.Repo.FindByClientID(ctx, *clientID)
		if err == nil && existing != nil {
			return existing, nil // Already created — return the same order
		}
	}

	order := &domain.Order{
		CustomerID:     input.CustomerID,
		Status:         domain.StatusReceived,
		PaymentStatus:  domain.PaymentPending,
		Notes:          input.Notes,
		DiscountType:   input.DiscountType,
		DiscountAmount: input.DiscountAmount,
		TenantID:       tenantID,
		BranchID:       branchID,
		Module:         "LAUNDRY",
		ClientID:       clientID,
		ReceivedAt:     parseReceivedAt(input.ReceivedAt),
	}

	// Percentage discount must be within 0-100.
	if order.DiscountType == "PERCENTAGE" && (order.DiscountAmount < 0 || order.DiscountAmount > 100) {
		return nil, fmt.Errorf("percentage discount must be between 0 and 100")
	}

	// Reject negative quantities/weights — prevents negative-total orders.
	// Cap at sane maximums to prevent numeric-overflow 500s.
	for _, it := range input.Items {
		if it.Quantity <= 0 {
			return nil, fmt.Errorf("quantity must be positive")
		}
		if it.Quantity > 99999 {
			return nil, fmt.Errorf("quantity exceeds maximum (99999)")
		}
		if it.WeightKg != nil {
			if *it.WeightKg < 0 {
				return nil, fmt.Errorf("weight cannot be negative")
			}
			if *it.WeightKg > 9999 {
				return nil, fmt.Errorf("weight exceeds maximum (9999 kg)")
			}
		}
	}

	var items []domain.OrderItem
	for _, it := range input.Items {
		items = append(items, domain.OrderItem{
			ServiceID:        it.ServiceID,
			Quantity:         it.Quantity,
			WeightKg:         it.WeightKg,
			GarmentBreakdown: it.GarmentBreakdown,
		})
	}

	if err := s.Repo.Create(ctx, order, items); err != nil {
		return nil, fmt.Errorf("creating order: %w", err)
	}

	return order, nil
}

// parseReceivedAt parses the FE-supplied receivedAt (ISO-8601 or YYYY-MM-DD) into *time.Time.
// Returns nil when empty/unparseable so the repo defaults to NOW().
func parseReceivedAt(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02"} {
		if t, err := time.Parse(layout, *s); err == nil {
			tt := t
			return &tt
		}
	}
	return nil
}

// Get retrieves a single order.
func (s *Service) Get(ctx context.Context, id, tenantID string) (*domain.Order, error) {
	order, err := s.Repo.FindByID(ctx, id, tenantID)
	if err != nil {
		return nil, fmt.Errorf("finding order: %w", err)
	}
	if order == nil {
		return nil, fmt.Errorf("order not found")
	}
	return order, nil
}

// List returns paginated orders for a tenant.
func (s *Service) List(ctx context.Context, tenantID string, filter ListFilter) ([]*domain.Order, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	return s.Repo.List(ctx, tenantID, filter)
}

// ListItems returns the curated OrderRecord DTO list (matches TS). Pagination
// clamping is identical to List.
func (s *Service) ListItems(ctx context.Context, tenantID string, filter ListFilter) ([]*OrderListItem, int64, error) {
	if filter.Page < 1 {
		filter.Page = 1
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		filter.Limit = 20
	}
	return s.Repo.ListItems(ctx, tenantID, filter)
}
