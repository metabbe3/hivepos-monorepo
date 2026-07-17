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
	ID         string         `json:"id"`
	UserID     string         `json:"userId"`
	UserName   string         `json:"userName"`
	TenantID   string         `json:"-"`
	BranchID   string         `json:"branchId"`
	BranchName string         `json:"branchName"`
	Type       ClockEventType `json:"type"`
	Timestamp  time.Time      `json:"timestamp"`
}

// StaffStatus mirrors TS /api/attendance/status: per-staff today's worked ms + open clock-in.
type StaffStatus struct {
	ID      string  `json:"id"`
	Name    string  `json:"name"`
	Since   *string `json:"since"`
	TodayMs int64   `json:"todayMs"`
}
