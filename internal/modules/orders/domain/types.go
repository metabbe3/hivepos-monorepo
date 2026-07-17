package domain

import (
	"encoding/json"
	"time"
)

// OrderStatus mirrors the Prisma enum.
type OrderStatus string

const (
	StatusReceived   OrderStatus = "RECEIVED"
	StatusInProgress OrderStatus = "IN_PROGRESS"
	StatusReady      OrderStatus = "READY"
	StatusDelivered  OrderStatus = "DELIVERED"
	StatusCanceled   OrderStatus = "CANCELED"
)

// PaymentStatus mirrors the Prisma enum.
type PaymentStatus string

const (
	PaymentPending  PaymentStatus = "PENDING"
	PaymentPartial  PaymentStatus = "PARTIAL"
	PaymentPaid     PaymentStatus = "PAID"
	PaymentRefunded PaymentStatus = "REFUNDED"
)

// PaymentMethod mirrors the Prisma enum.
type PaymentMethod string

const (
	PayCash     PaymentMethod = "CASH"
	PayTransfer PaymentMethod = "TRANSFER"
	PayQRIS     PaymentMethod = "QRIS"
	PayDeposit  PaymentMethod = "DEPOSIT"
)

// PricingType mirrors the Prisma enum.
type PricingType string

const (
	PerKg    PricingType = "PER_KG"
	PerItem  PricingType = "PER_ITEM"
	FlatRate PricingType = "FLAT"
)

// Order is the domain entity.
type Order struct {
	ID             string        `json:"id"`
	OrderNumber    string        `json:"orderNumber"`
	CustomerID     string        `json:"customerId"`
	Status         OrderStatus   `json:"status"`
	PaymentStatus  PaymentStatus `json:"paymentStatus"`
	TotalAmount    float64       `json:"totalAmount"`
	DiscountAmount float64       `json:"discountAmount"`
	DiscountType   string        `json:"discountType,omitempty"`
	Notes          string        `json:"notes,omitempty"`
	BranchID       string        `json:"branchId"`
	TenantID       string        `json:"tenantId"`
	Module         string        `json:"module"`
	ClientID       *string       `json:"clientId,omitempty"`
	ReceivedAt     *time.Time    `json:"receivedAt,omitempty"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
}

// OrderItem is a line item within an order.
type OrderItem struct {
	ID               string          `json:"id"`
	OrderID          string          `json:"orderId"`
	ServiceID        string          `json:"serviceId"`
	Quantity         float64         `json:"quantity"`
	WeightKg         *float64        `json:"weightKg,omitempty"`
	PricePerUnit     float64         `json:"pricePerUnit"`
	Subtotal         float64         `json:"subtotal"`
	GarmentBreakdown json.RawMessage `json:"garmentBreakdown,omitempty"`
}
