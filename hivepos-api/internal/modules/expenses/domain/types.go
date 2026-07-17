package domain

import "time"

// Expense is a single cost line item recorded against a branch + optional category.
type Expense struct {
	ID          string            `json:"id"`
	Amount      float64           `json:"amount"`
	Description *string           `json:"description"`
	Date        time.Time         `json:"date"`
	BranchID    string            `json:"branchId"`
	CategoryID  *string           `json:"categoryId"`
	Category    *ExpenseCategory  `json:"category,omitempty"`
	CreatedAt   time.Time         `json:"createdAt"`
}

// ExpenseCategory groups expenses within a branch.
type ExpenseCategory struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	BranchID    string    `json:"branchId"`
	CreatedAt   time.Time `json:"createdAt"`
}
