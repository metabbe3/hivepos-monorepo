package domain

import "time"

// Stats is the aggregate dashboard metrics payload.
// Simplified from the TS dashboard/stats endpoint (which runs 17 parallel
// queries with WIB-correct date bounds). This version returns the headline
// numbers in a few aggregation queries.
type Stats struct {
	TotalOrders      int64              `json:"totalOrders"`
	TotalCustomers   int64              `json:"totalCustomers"`
	TotalRevenue     float64            `json:"totalRevenue"`
	TotalExpenses    float64            `json:"totalExpenses"`
	OrdersByStatus   map[string]int64   `json:"ordersByStatus"`
	RevenueByStatus  map[string]float64 `json:"revenueByStatus"`
	PaymentBreakdown map[string]float64 `json:"paymentBreakdown"`
	PeriodFrom       time.Time          `json:"periodFrom"`
	PeriodTo         time.Time          `json:"periodTo"`
}

// KanbanEntry is one status bucket in the order pipeline.
type KanbanEntry struct {
	Status string  `json:"status"`
	Count  int64   `json:"count"`
	Sum    float64 `json:"sum"`
}

// HeatmapPoint is one hour-of-week aggregation cell.
type HeatmapPoint struct {
	DayOfWeek int   `json:"dayOfWeek"` // 0=Sun .. 6=Sat
	Hour      int   `json:"hour"`      // 0..23
	Count     int64 `json:"count"`
}
