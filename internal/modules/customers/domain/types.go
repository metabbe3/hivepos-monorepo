package domain

import "time"

type CustomerStatus string

const (
	StatusActive  CustomerStatus = "ACTIVE"
	StatusAtRisk  CustomerStatus = "AT_RISK"
	StatusLapsed  CustomerStatus = "LAPSED"
	StatusNew     CustomerStatus = "NEW"
)

type Customer struct {
	ID        string  `json:"id"`
	Name      string  `json:"name"`
	Phone     *string `json:"phone"`
	Email     *string `json:"email"`
	Notes     *string `json:"notes"`
	Balance   float64 `json:"balance"`
	BranchID  string  `json:"branchId"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
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
	TotalOrders   int     `json:"totalOrders"`
	TotalSpent    float64 `json:"totalSpent"`
	LastOrderDate *time.Time `json:"lastOrderDate,omitempty"`
}
