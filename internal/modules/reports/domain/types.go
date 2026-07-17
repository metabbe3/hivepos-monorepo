package domain

// ReportFilter mirrors the shared query params (branchId, startDate, endDate).
// Brought in via application.ReportFilter; domain keeps the value shape only
// to avoid an import cycle when repository methods need it.

// --- Orders report ---

// OrdersReport mirrors the running TS /api/reports/orders shape.
type OrdersReport struct {
	Summary                OrdersSummary       `json:"summary"`
	ByStatus               []OrderStatusGroup  `json:"byStatus"`
	ServiceBreakdown       []OrderServiceUsage `json:"serviceBreakdown"`
	TurnaroundDistribution TurnaroundDist      `json:"turnaroundDistribution"`
	DailyVolume            []DailyVolume       `json:"dailyVolume"`
}

type OrdersSummary struct {
	TotalOrders        int64    `json:"totalOrders"`
	AvgTurnaroundHours *float64 `json:"avgTurnaroundHours"`
	TotalItems         float64  `json:"totalItems"`
	TotalWeightKg      float64  `json:"totalWeightKg"`
}

type OrderStatusGroup struct {
	Status      string  `json:"status"`
	Count       int64   `json:"count"`
	TotalAmount float64 `json:"totalAmount"`
}

type OrderServiceUsage struct {
	ServiceID   string  `json:"serviceId"`
	Name        string  `json:"name"`
	PricingType string  `json:"pricingType"`
	OrderCount  int64   `json:"orderCount"`
	Quantity    float64 `json:"quantity"`
	WeightKg    float64 `json:"weightKg"`
	Revenue     float64 `json:"revenue"`
}

type TurnaroundDist struct {
	Under24h int `json:"under24h"`
	Under48h int `json:"under48h"`
	Under72h int `json:"under72h"`
	Over72h  int `json:"over72h"`
}

type DailyVolume struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

// --- Revenue report ---

// RevenueReport mirrors the running TS /api/reports/revenue shape.
type RevenueReport struct {
	Summary         RevenueSummary   `json:"summary"`
	ByPaymentMethod []RevenueMethod  `json:"byPaymentMethod"`
	DailyTrend      []RevenueDaily   `json:"dailyTrend"`
	ByPaymentStatus []RevenuePayStat `json:"byPaymentStatus"`
}

type RevenueSummary struct {
	GrossRevenue  float64 `json:"grossRevenue"`
	TotalDiscount float64 `json:"totalDiscount"`
	NetRevenue    float64 `json:"netRevenue"`
	TotalPaid     float64 `json:"totalPaid"`
	OrdersCount   int64   `json:"ordersCount"`
}

type RevenueMethod struct {
	Method string  `json:"method"`
	Count  int64   `json:"count"`
	Total  float64 `json:"total"`
}

type RevenueDaily struct {
	Date         string             `json:"date"`
	Revenue      float64            `json:"revenue"`
	GrossRevenue float64            `json:"grossRevenue"`
	NetRevenue   float64            `json:"netRevenue"`
	Orders       int                `json:"orders"`
	ByMethod     map[string]float64 `json:"byMethod"`
}

type RevenuePayStat struct {
	Status      string  `json:"status"`
	Count       int64   `json:"count"`
	TotalAmount float64 `json:"totalAmount"`
	PaidAmount  float64 `json:"paidAmount"`
}

// ServicesReport mirrors TS /api/reports/services.
type ServicesReport struct {
	Services      []ServicesReportItem          `json:"services"`
	ByPricingType map[string]ServicesPricingAgg `json:"byPricingType"`
}

type ServicesPricingAgg struct {
	OrderCount    int64   `json:"orderCount"`
	Revenue       float64 `json:"revenue"`
	TotalQuantity float64 `json:"totalQuantity,omitempty"`
	TotalWeightKg float64 `json:"totalWeightKg,omitempty"`
}

type ServicesReportItem struct {
	ServiceID     string  `json:"serviceId"`
	Name          string  `json:"name"`
	TotalQuantity float64 `json:"totalQuantity"`
	TotalWeightKg float64 `json:"totalWeightKg"`
	TotalRevenue  float64 `json:"totalRevenue"`
	AvgOrderValue float64 `json:"avgOrderValue"`
	BasePrice     float64 `json:"basePrice"`
	OrderCount    int64   `json:"orderCount"`
	PricingType   string  `json:"pricingType"`
}

// CommissionReport mirrors TS /api/reports/commission.
type CommissionReport struct {
	Summary   CommissionSummary    `json:"summary"`
	ByService []CommissionBySvcRow `json:"byService"`
}

type CommissionSummary struct {
	TotalRevenue    float64 `json:"totalRevenue"`
	TotalCommission float64 `json:"totalCommission"`
}

type CommissionBySvcRow struct {
	ServiceID       string  `json:"serviceId"`
	Name            string  `json:"name"`
	PricingType     string  `json:"pricingType"`
	CommissionType  string  `json:"commissionType"`
	CommissionValue float64 `json:"commissionValue"`
	Revenue         float64 `json:"revenue"`
	OrderCount      int64   `json:"orderCount"`
	Commission      float64 `json:"commission"`
}

// InventoryReport mirrors TS /api/reports/inventory.
type InventoryReport struct {
	Summary         InventorySummary    `json:"summary"`
	StockLevels     []InventoryStockRow `json:"stockLevels"`
	RecentMovements []InventoryMovement `json:"recentMovements"`
}

type InventorySummary struct {
	TotalItems      int     `json:"totalItems"`
	TotalValue      float64 `json:"totalValue"`
	LowStockCount   int     `json:"lowStockCount"`
	RecentPurchases int     `json:"recentPurchases"`
}

type InventoryStockRow struct {
	Name      string  `json:"name"`
	Unit      string  `json:"unit"`
	Quantity  float64 `json:"quantity"`
	Threshold float64 `json:"threshold"`
	Value     float64 `json:"value"`
	IsLow     bool    `json:"isLow"`
}

type InventoryMovement struct {
	Name     string  `json:"name"`
	Type     string  `json:"type"`
	Quantity float64 `json:"quantity"`
	Date     string  `json:"date"`
	Notes    string  `json:"notes"`
}

// --- Customers report ---

// CustomersReport mirrors the running TS /api/reports/customers shape.
type CustomersReport struct {
	Summary            CustomersSummary      `json:"summary"`
	TopSpenders        []CustomerSpender     `json:"topSpenders"`
	OutstandingBalance []CustomerOutstanding `json:"outstandingBalance"`
}

type CustomersSummary struct {
	TotalCustomers      int64   `json:"totalCustomers"`
	NewCustomers        int64   `json:"newCustomers"`
	NewInPeriod         int     `json:"newInPeriod"`
	ReturningInPeriod   int     `json:"returningInPeriod"`
	AvgSpendPerCustomer float64 `json:"avgSpendPerCustomer"`
}

type CustomerSpender struct {
	CustomerID string  `json:"customerId"`
	Name       string  `json:"name"`
	Orders     int64   `json:"orders"`
	TotalSpent float64 `json:"totalSpent"`
}

type CustomerOutstanding struct {
	CustomerID       string  `json:"customerId"`
	Name             string  `json:"name"`
	Phone            string  `json:"phone"`
	TotalOutstanding float64 `json:"totalOutstanding"`
	OrderCount       int     `json:"orderCount"`
}

// --- Expenses report ---

// ExpensesReport mirrors the running TS /api/reports/expenses shape.
type ExpensesReport struct {
	Summary    ExpensesSummary      `json:"summary"`
	ByCategory []ExpenseCategoryRow `json:"byCategory"`
	DailyTrend []ExpenseDailyRow    `json:"dailyTrend"`
}

type ExpensesSummary struct {
	TotalExpenses float64 `json:"totalExpenses"`
	CategoryCount int     `json:"categoryCount"`
	DailyAvg      float64 `json:"dailyAvg"`
}

type ExpenseCategoryRow struct {
	Category string  `json:"category"`
	Count    int64   `json:"count"`
	Total    float64 `json:"total"`
}

type ExpenseDailyRow struct {
	Date  string  `json:"date"`
	Total float64 `json:"total"`
	Count int     `json:"count"`
}

// MonthlyPnL mirrors TS /api/reports/monthly-pnl (the most complex report).
type MonthlyPnL struct {
	Month             int                `json:"month"`
	Year              int                `json:"year"`
	MonthName         string             `json:"monthName"`
	PnL               PnLDetail          `json:"pnl"`
	ExpenseDetails    []ExpenseDetailRow `json:"expenseDetails"`
	DailyTransactions []DailyTransaction `json:"dailyTransactions"`
	AnnualComparison  []AnnualMonth      `json:"annualComparison"`
}

type PnLDetail struct {
	Income               PnLIncome       `json:"income"`
	UnpaidBalance        float64         `json:"unpaidBalance"`
	CashCollected        float64         `json:"cashCollected"`
	CashCollectedByMonth []CashByMonth   `json:"cashCollectedByMonth"`
	Expenses             []PnLExpenseRow `json:"expenses"`
	TotalExpenses        float64         `json:"totalExpenses"`
	NetProfit            float64         `json:"netProfit"`
	MarginPercent        float64         `json:"marginPercent"`
}

type PnLIncome struct {
	PerKg   float64 `json:"perKg"`
	PerItem float64 `json:"perItem"`
	Total   float64 `json:"total"`
}

type CashByMonth struct {
	Month     string  `json:"month"`
	Amount    float64 `json:"amount"`
	IsCurrent bool    `json:"isCurrent"`
}

type PnLExpenseRow struct {
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

type ExpenseDetailRow struct {
	Date        string  `json:"date"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
}

type DailyTransaction struct {
	Date         string             `json:"date"`
	DayName      string             `json:"dayName"`
	DateNumber   int                `json:"dateNumber"`
	Orders       []DailyOrderDetail `json:"orders"`
	DayTotal     float64            `json:"dayTotal"`
	RunningTotal float64            `json:"runningTotal"`
}

type DailyOrderDetail struct {
	CustomerName string      `json:"customerName"`
	WeightKg     float64     `json:"weightKg"`
	Items        []DailyItem `json:"items"`
	ItemSummary  string      `json:"itemSummary"`
	Amount       float64     `json:"amount"`
}

type DailyItem struct {
	Name string  `json:"name"`
	Qty  float64 `json:"qty"`
}

type AnnualMonth struct {
	Month     int     `json:"month"`
	MonthName string  `json:"monthName"`
	Revenue   float64 `json:"revenue"`
	Expenses  float64 `json:"expenses"`
	NetProfit float64 `json:"netProfit"`
}

// --- Profit ---

type ProfitReport struct {
	Summary         ProfitSummary    `json:"summary"`
	DailyComparison []ProfitDailyRow `json:"dailyComparison"`
}

type ProfitSummary struct {
	Revenue       float64 `json:"revenue"`
	Expenses      float64 `json:"expenses"`
	NetProfit     float64 `json:"netProfit"`
	MarginPercent float64 `json:"marginPercent"`
}

type ProfitDailyRow struct {
	Date     string  `json:"date"`
	Revenue  float64 `json:"revenue"`
	Expenses float64 `json:"expenses"`
	Profit   float64 `json:"profit"`
}

// --- Outstanding ---

type OutstandingReport struct {
	Summary   OutstandingSummary    `json:"summary"`
	Customers []OutstandingCustomer `json:"customers"`
}

type OutstandingSummary struct {
	TotalOutstanding  float64 `json:"totalOutstanding"`
	CustomersAffected int     `json:"customersAffected"`
	OrdersAffected    int     `json:"ordersAffected"`
}

type OutstandingCustomer struct {
	CustomerID       string             `json:"customerId"`
	Name             string             `json:"name"`
	Phone            string             `json:"phone"`
	TotalOutstanding float64            `json:"totalOutstanding"`
	OrderCount       int                `json:"orderCount"`
	OldestOrder      string             `json:"oldestOrder"`
	Orders           []OutstandingOrder `json:"orders"`
}

type OutstandingOrder struct {
	OrderNumber string  `json:"orderNumber"`
	Outstanding float64 `json:"outstanding"`
	CreatedAt   string  `json:"createdAt"`
}

// PaymentCollection mirrors TS /api/reports/payment-collection.
type PaymentCollection struct {
	Summary                  PaymentCollSummary `json:"summary"`
	PaymentsCollectedByMonth []PaymentCollMonth `json:"paymentsCollectedByMonth"`
	UnpaidByMonth            []UnpaidMonth      `json:"unpaidByMonth"`
}

type PaymentCollSummary struct {
	TotalCollected    float64 `json:"totalCollected"`
	TotalUnpaidOrders int     `json:"totalUnpaidOrders"`
	TotalOutstanding  float64 `json:"totalOutstanding"`
	OldestUnpaid      *string `json:"oldestUnpaid"`
}

type PaymentCollMonth struct {
	Month          string          `json:"month"`
	PaymentCount   int             `json:"paymentCount"`
	TotalCollected float64         `json:"totalCollected"`
	OrderCount     int             `json:"orderCount"`
	Payments       []PaymentDetail `json:"payments"`
}

type PaymentDetail struct {
	PaymentID        string  `json:"paymentId"`
	Amount           float64 `json:"amount"`
	PaymentDate      string  `json:"paymentDate"`
	OrderNumber      string  `json:"orderNumber"`
	OrderID          string  `json:"orderId"`
	CustomerName     string  `json:"customerName"`
	CustomerID       string  `json:"customerId"`
	CustomerPhone    string  `json:"customerPhone"`
	OrderCreatedDate string  `json:"orderCreatedDate"`
}

type UnpaidMonth struct {
	Month            string        `json:"month"`
	Count            int           `json:"count"`
	TotalOutstanding float64       `json:"totalOutstanding"`
	Orders           []UnpaidOrder `json:"orders"`
}

type UnpaidOrder struct {
	OrderID       string  `json:"orderId"`
	OrderNumber   string  `json:"orderNumber"`
	TotalAmount   float64 `json:"totalAmount"`
	PaidAmount    float64 `json:"paidAmount"`
	Outstanding   float64 `json:"outstanding"`
	CreatedAt     string  `json:"createdAt"`
	CustomerName  string  `json:"customerName"`
	CustomerID    string  `json:"customerId"`
	CustomerPhone string  `json:"customerPhone"`
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
	EmployeeID   string  `json:"employeeId"`
	TotalHours   float64 `json:"totalHours"`
	ClockInCount int64   `json:"clockInCount"`
}

// --- Inventory (low stock) ---

type InventoryItem struct {
	ID       string  `json:"id"`
	Name     string  `json:"name"`
	Quantity float64 `json:"quantity"`
	MinStock float64 `json:"minStock"`
}

// PiutangReport mirrors TS /api/reports/piutang-tracker.
type PiutangReport struct {
	MonthlySummary        []PiutangMonthly       `json:"monthlySummary"`
	AgingBuckets          map[string]AgingBucket `json:"agingBuckets"`
	TotalOutstanding      float64                `json:"totalOutstanding"`
	OutstandingOrderCount int                    `json:"outstandingOrderCount"`
	Orders                []PiutangOrder         `json:"orders"`
}

type AgingBucket struct {
	Count  int     `json:"count"`
	Amount float64 `json:"amount"`
}

type PiutangMonthly struct {
	Month            string  `json:"month"`
	NewOrders        int     `json:"newOrders"`
	NewPiutang       float64 `json:"newPiutang"`
	PaidSoFar        float64 `json:"paidSoFar"`
	StillOutstanding float64 `json:"stillOutstanding"`
	FullyPaidCount   int     `json:"fullyPaidCount"`
}

type PiutangOrder struct {
	ID          string  `json:"id"`
	OrderNumber string  `json:"orderNumber"`
	Customer    string  `json:"customer"`
	Status      string  `json:"status"`
	TotalAmount float64 `json:"totalAmount"`
	PaidAmount  float64 `json:"paidAmount"`
	Outstanding float64 `json:"outstanding"`
	CreatedAt   string  `json:"createdAt"`
	AgeDays     int     `json:"ageDays"`
	Bucket      string  `json:"bucket"`
	Payments    []any   `json:"payments"`
}

// FinancialStatement mirrors TS /api/reports/financial-statement.
type FinancialStatement struct {
	Summary            FinSummary     `json:"summary"`
	DailyBreakdown     []FinDaily     `json:"dailyBreakdown"`
	TopServices        []FinTopItem   `json:"topServices"`
	ExpensesByCategory []interface{}  `json:"expensesByCategory"`
	ByPaymentMethod    []interface{}  `json:"byPaymentMethod"`
	TopCustomers       []FinTopItem   `json:"topCustomers"`
	Outstanding        FinOutstanding `json:"outstanding"`
	Turnaround         FinTurnaround  `json:"turnaround"`
	Inventory          FinInventory   `json:"inventory"`
}

type FinSummary struct {
	Revenue           float64 `json:"revenue"`
	Expenses          float64 `json:"expenses"`
	NetProfit         float64 `json:"netProfit"`
	MarginPercent     float64 `json:"marginPercent"`
	TotalOrders       int64   `json:"totalOrders"`
	AvgOrderValue     float64 `json:"avgOrderValue"`
	TotalOutstanding  float64 `json:"totalOutstanding"`
	AffectedCustomers int     `json:"affectedCustomers"`
}

type FinDaily struct {
	Date     string  `json:"date"`
	Revenue  float64 `json:"revenue"`
	Expenses float64 `json:"expenses"`
	Orders   int     `json:"orders"`
	Profit   float64 `json:"profit"`
}

type FinTopItem struct {
	Name       string  `json:"name"`
	OrderCount int64   `json:"orderCount"`
	Revenue    float64 `json:"revenue,omitempty"`
	TotalSpent float64 `json:"totalSpent,omitempty"`
}

type FinOutstanding struct {
	Total             float64         `json:"total"`
	CustomersAffected int             `json:"customersAffected"`
	OrdersAffected    int             `json:"ordersAffected"`
	TopBalances       []FinTopBalance `json:"topBalances"`
}

type FinTopBalance struct {
	Name        string  `json:"name"`
	Balance     float64 `json:"balance"`
	OldestOrder string  `json:"oldestOrder"`
}

type FinTurnaround struct {
	Under24hPercent float64        `json:"under24hPercent"`
	TotalDelivered  int            `json:"totalDelivered"`
	Distribution    map[string]int `json:"distribution"`
}

type FinInventory struct {
	TotalItems    int     `json:"totalItems"`
	TotalValue    float64 `json:"totalValue"`
	LowStockCount int     `json:"lowStockCount"`
}

// --- Export stub ---

type ExportStub struct {
	Format string `json:"format"`
	URL    string `json:"url"`
	Note   string `json:"note"`
}
