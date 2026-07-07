package domain

import "time"

// ReportFilter mirrors the shared query params (branchId, startDate, endDate).
// Brought in via application.ReportFilter; domain keeps the value shape only
// to avoid an import cycle when repository methods need it.

// --- Orders report ---

type OrdersReport struct {
	TotalOrders int64                  `json:"totalOrders"`
	TotalRevenue float64               `json:"totalRevenue"`
	ByStatus    map[string]int64       `json:"byStatus"`
	Breakdown   []StatusBreakdown      `json:"breakdown"`
}

type StatusBreakdown struct {
	Status string `json:"status"`
	Count  int64  `json:"count"`
}

// --- Revenue report ---

type RevenueReport struct {
	TotalRevenue float64                  `json:"totalRevenue"`
	ByMethod     map[string]float64       `json:"byMethod"`
	Breakdown    []MethodBreakdown        `json:"breakdown"`
}

type MethodBreakdown struct {
	Method  string  `json:"method"`
	Amount  float64 `json:"amount"`
}

// --- Services report ---

type ServiceUsage struct {
	ServiceID   string  `json:"serviceId"`
	ServiceName string  `json:"serviceName"`
	Quantity    float64 `json:"quantity"`
	Revenue     float64 `json:"revenue"`
}

// --- Customers report ---

type CustomersReport struct {
	NewCustomers    int64             `json:"newCustomers"`
	RepeatCustomers int64             `json:"repeatCustomers"`
	TopCustomers    []TopCustomer     `json:"topCustomers"`
}

type TopCustomer struct {
	CustomerID   string  `json:"customerId"`
	CustomerName string  `json:"customerName"`
	OrderCount   int64   `json:"orderCount"`
	TotalSpent   float64 `json:"totalSpent"`
}

// --- Expenses report ---

type ExpensesReport struct {
	TotalExpenses float64                `json:"totalExpenses"`
	ByCategory    map[string]float64     `json:"byCategory"`
	Breakdown     []CategoryBreakdown    `json:"breakdown"`
}

type CategoryBreakdown struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

// --- Monthly P&L ---

type MonthlyPnL struct {
	Month    string  `json:"month"`
	Revenue  float64 `json:"revenue"`
	Expenses float64 `json:"expenses"`
	Profit   float64 `json:"profit"`
}

// --- Profit ---

type ProfitReport struct {
	TotalRevenue  float64 `json:"totalRevenue"`
	TotalExpenses float64 `json:"totalExpenses"`
	NetProfit     float64 `json:"netProfit"`
}

// --- Outstanding ---

type OutstandingReport struct {
	TotalOutstanding float64 `json:"totalOutstanding"`
	OrderCount       int64   `json:"orderCount"`
}

// --- Payment collection (today) ---

type PaymentCollection struct {
	Method string  `json:"method"`
	Amount float64 `json:"amount"`
}

// --- Commission ---

type CommissionRow struct {
	StaffID    string  `json:"staffId"`
	StaffName  string  `json:"staffName"`
	OrderCount int64   `json:"orderCount"`
	Commission float64 `json:"commission"`
}

// --- Attendance ---

type AttendanceRow struct {
	EmployeeID    string  `json:"employeeId"`
	TotalHours    float64 `json:"totalHours"`
	ClockInCount  int64   `json:"clockInCount"`
}

// --- Inventory (low stock) ---

type InventoryItem struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	MinStock float64 `json:"minStock"`
}

// --- Piutang tracker (accounts receivable) ---

type PiutangRow struct {
	CustomerID   string  `json:"customerId"`
	CustomerName string  `json:"customerName"`
	TotalDue     float64 `json:"totalDue"`
	OrderCount   int64   `json:"orderCount"`
}

// --- Financial statement (aggregate) ---

type FinancialStatement struct {
	TotalRevenue   float64             `json:"totalRevenue"`
	TotalExpenses  float64             `json:"totalExpenses"`
	NetProfit      float64             `json:"netProfit"`
	Outstanding    float64             `json:"outstanding"`
	RevenueByMethod map[string]float64 `json:"revenueByMethod"`
	ExpensesByCategory map[string]float64 `json:"expensesByCategory"`
	GeneratedAt    time.Time           `json:"generatedAt"`
}

// --- Export stub ---

type ExportStub struct {
	Format string `json:"format"`
	URL    string `json:"url"`
	Note   string `json:"note"`
}
