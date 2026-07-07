package domain

import "time"

// ClockEventType mirrors the Prisma enum.
type ClockEventType string

const (
	ClockIn  ClockEventType = "CLOCK_IN"
	ClockOut ClockEventType = "CLOCK_OUT"
)

// StaffMember is an attendance-scoped view of a User (PIN-based clock).
type StaffMember struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	BranchID  string    `json:"branchId"`
	PinHash   *string   `json:"-"` // never serialized to the client
	QrToken   *string   `json:"qrToken,omitempty"`
	IsActive  bool      `json:"isActive"`
	CreatedAt time.Time `json:"createdAt"`
}

// ClockEvent is a single clock-in/out record.
type ClockEvent struct {
	ID        string         `json:"id"`
	UserID    string         `json:"userId"`
	TenantID  string         `json:"tenantId"`
	BranchID  string         `json:"branchId"`
	Type      ClockEventType `json:"type"`
	Timestamp time.Time      `json:"timestamp"`
}

// StaffStatus is the current clock state of a staff member.
type StaffStatus struct {
	UserID    string      `json:"userId"`
	Name      string      `json:"name"`
	Status    string      `json:"status"` // "CLOCKED_IN" | "CLOCKED_OUT"
	LastEvent *ClockEvent `json:"lastEvent,omitempty"`
}
