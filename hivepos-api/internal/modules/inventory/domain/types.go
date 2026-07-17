package domain

import "time"

// MovementType mirrors the Prisma StockMovementType enum.
type MovementType string

const (
	MovementIn         MovementType = "IN"
	MovementOut        MovementType = "OUT"
	MovementAdjustment MovementType = "ADJUSTMENT"
)

// StockItem is a tracked consumable/supply within a branch.
type StockItem struct {
	ID                   string     `json:"id"`
	Name                 string     `json:"name"`
	Unit                 string     `json:"unit"`
	CurrentQuantity      float64    `json:"currentQuantity"`
	LowStockThreshold    float64    `json:"lowStockThreshold"`
	PurchasePricePerUnit float64    `json:"purchasePricePerUnit"`
	IsActive             bool       `json:"isActive"`
	BranchID             string     `json:"branchId"`
	CreatedAt            time.Time  `json:"createdAt"`
	UpdatedAt            time.Time  `json:"updatedAt"`
}

// StockMovement records an IN/OUT/ADJUSTMENT delta on a stock item.
type StockMovement struct {
	ID         string       `json:"id"`
	StockItemID string      `json:"stockItemId"`
	Type       MovementType `json:"type"`
	Quantity   float64      `json:"quantity"`
	Date       time.Time    `json:"date"`
	Notes      *string      `json:"notes"`
	CreatedAt  time.Time    `json:"createdAt"`
}
