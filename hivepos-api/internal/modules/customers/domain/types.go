package domain

import "time"

type CustomerStatus string

const (
	StatusActive CustomerStatus = "ACTIVE"
	StatusAtRisk CustomerStatus = "AT_RISK"
	StatusLapsed CustomerStatus = "LAPSED"
	StatusNew    CustomerStatus = "NEW"
)

type Customer struct {
	ID             string        `json:"id"`
	Name           string        `json:"name"`
	Phone          *string       `json:"phone"`
	Email          *string       `json:"email"`
	Notes          *string       `json:"notes"`
	Balance        float64       `json:"balance"`
	BranchID       string        `json:"branchId"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
	TotalOrders    int           `json:"totalOrders"`
	TotalSpent     float64       `json:"totalSpent"`
	LastOrderDate  *time.Time    `json:"lastOrderDate,omitempty"`
	CustomerStatus CustomerStatus `json:"customerStatus"`
	// Orders is populated only on the detail GET (GET /api/customers/{id}) — matches
	// the TS CustomerDetailDTO so the FE detail page can render order/payment history.
	Orders []CustomerOrder `json:"orders,omitempty"`
}

// CustomerOrder is one order in a customer's detail history.
type CustomerOrder struct {
	ID          string            `json:"id"`
	OrderNumber string            `json:"orderNumber"`
	Status      string            `json:"status"`
	TotalAmount float64           `json:"totalAmount"`
	PaidAmount  float64           `json:"paidAmount"`
	CreatedAt   time.Time         `json:"createdAt"`
	ItemCount   int               `json:"itemCount"`
	Payments    []CustomerPayment `json:"payments"`
}

// CustomerPayment is one payment row on a customer's order.
type CustomerPayment struct {
	ID            string    `json:"id"`
	Amount        float64   `json:"amount"`
	PaymentMethod string    `json:"paymentMethod"`
	CreatedAt     time.Time `json:"createdAt"`
}

type DepositTransaction struct {
	ID           string    `json:"id"`
	CustomerID   string    `json:"customerId"`
	Type         string    `json:"type"` // TOP_UP | DEDUCTION | REFUND | ADJUSTMENT
	Amount       float64   `json:"amount"`
	BalanceAfter float64   `json:"balanceAfter"`
	Notes        *string   `json:"notes"`
	CreatedAt    time.Time `json:"createdAt"`
}

type CustomerStats struct {
	TotalOrders   int        `json:"totalOrders"`
	TotalSpent    float64    `json:"totalSpent"`
	LastOrderDate *time.Time `json:"lastOrderDate,omitempty"`
}
