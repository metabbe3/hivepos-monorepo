package domain

import "time"

// Stats mirrors TS /api/dashboard/stats (21-field computed dashboard).
type Stats struct {
	TodayOrders            int64                  `json:"todayOrders"`
	InProgress             int64                  `json:"inProgress"`
	ReadyForPickup         int64                  `json:"readyForPickup"`
	TodayRevenue           float64                `json:"todayRevenue"`
	TodayOmset             float64                `json:"todayOmset"`
	OmsetChange            *float64               `json:"omsetChange"`
	PreviousRevenue        float64                `json:"previousRevenue"`
	RevenueChange          *float64               `json:"revenueChange"`
	TopCustomers           []DashboardTopCustomer `json:"topCustomers"`
	ServiceBreakdown       []DashboardService     `json:"serviceBreakdown"`
	PaymentMethodBreakdown []DashboardPayment     `json:"paymentMethodBreakdown"`
	// PaymentBreakdown is the map form (method→total) the dashboard FE reads
	// (g.paymentBreakdown ?? g.paymentMethodBreakdown). Populated by GetStats.
	PaymentBreakdown       map[string]float64     `json:"paymentBreakdown"`
	RecentOrders           []DashboardRecentOrder `json:"recentOrders"`
	CashFlow               CashFlow               `json:"cashFlow"`
	OrderPipeline          map[string]int64       `json:"orderPipeline"`
	LowStock               []LowStockItem         `json:"lowStock"`
	CustomerInsights       CustomerInsights       `json:"customerInsights"`
	Comparison             DashboardComparison    `json:"comparison"`
	UnpaidDelivered        int64                  `json:"unpaidDelivered"`
	UnpaidOrders           []UnpaidOrderDash      `json:"unpaidOrders"`
	Turnaround             Turnaround             `json:"turnaround"`
	Sparkline              []int64                `json:"sparkline"`
}

type DashboardTopCustomer struct {
	CustomerID string  `json:"customerId"`
	Name       string  `json:"name"`
	Orders     int64   `json:"orders"`
	TotalSpent float64 `json:"totalSpent"`
}

type DashboardService struct {
	ServiceID string  `json:"serviceId"`
	Name      string  `json:"name"`
	Orders    int64   `json:"orders"`
	Revenue   float64 `json:"revenue"`
}

type DashboardPayment struct {
	Method string  `json:"method"`
	Count  int64   `json:"count"`
	Total  float64 `json:"total"`
}

type DashboardRecentOrder struct {
	ID           string  `json:"id"`
	OrderNumber  string  `json:"orderNumber"`
	CustomerName string  `json:"customerName"`
	Status       string  `json:"status"`
	TotalAmount  float64 `json:"totalAmount"`
	CreatedAt    string  `json:"createdAt"`
}

type CashFlow struct {
	Income         float64 `json:"income"`
	Expenses       float64 `json:"expenses"`
	Net            float64 `json:"net"`
	WalletDeposits float64 `json:"walletDeposits"`
}

type LowStockItem struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	Unit              string  `json:"unit"`
	CurrentQuantity   float64 `json:"currentQuantity"`
	LowStockThreshold float64 `json:"lowStockThreshold"`
}

type CustomerInsights struct {
	Total       int64 `json:"total"`
	NewThisWeek int64 `json:"newThisWeek"`
	Active      int64 `json:"active"`
	AtRisk      int64 `json:"atRisk"`
	Lapsed      int64 `json:"lapsed"`
}

type DashboardComparison struct {
	Revenue     ComparisonMetric `json:"revenue"`
	Orders      ComparisonMetric `json:"orders"`
	Expenses    ComparisonMetric `json:"expenses"`
	NetCashFlow ComparisonMetric `json:"netCashFlow"`
}

type ComparisonMetric struct {
	Current       float64  `json:"current"`
	Previous      float64  `json:"previous"`
	ChangePercent *float64 `json:"changePercent"`
}

type UnpaidOrderDash struct {
	ID            string  `json:"id"`
	OrderNumber   string  `json:"orderNumber"`
	CustomerName  string  `json:"customerName"`
	CustomerPhone string  `json:"customerPhone"`
	TotalAmount   float64 `json:"totalAmount"`
	Status        string  `json:"status"`
	PaymentStatus string  `json:"paymentStatus"`
	CreatedAt     string  `json:"createdAt"`
}

type Turnaround struct {
	AvgHours       *float64 `json:"avgHours"`
	FastestHours   *float64 `json:"fastestHours"`
	SlowestHours   *float64 `json:"slowestHours"`
	CompletedCount int      `json:"completedCount"`
}

// KanbanEntry is one status bucket in the order pipeline.
type KanbanEntry struct {
	Status string  `json:"status"`
	Count  int64   `json:"count"`
	Sum    float64 `json:"sum"`
}

// HeatmapPoint is one hour-of-week aggregation cell.
type HeatmapPoint struct {
	DayOfWeek int   `json:"dayOfWeek"`
	Hour      int   `json:"hour"`
	Count     int64 `json:"count"`
}

var _ = time.Time{}
