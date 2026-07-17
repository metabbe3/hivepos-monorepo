package application

import (
	"context"
	"fmt"

	"github.com/hivepos/api/internal/modules/reports/domain"
)

// ReportFilter is the shared query-param DTO for every report endpoint.
type ReportFilter struct {
	BranchID  string
	StartDate string // ISO timestamp string; empty → default window
	EndDate   string
}

// Repository is the persistence port (hexagonal). One method per report.
type Repository interface {
	GetOrdersReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.OrdersReport, error)
	GetRevenueReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.RevenueReport, error)
	GetServicesReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.ServicesReport, error)
	GetCustomersReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.CustomersReport, error)
	GetExpensesReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.ExpensesReport, error)
	GetMonthlyPnL(ctx context.Context, tenantID string, month, year int) (*domain.MonthlyPnL, error)
	GetProfitReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.ProfitReport, error)
	GetOutstandingReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.OutstandingReport, error)
	GetPaymentCollection(ctx context.Context, tenantID string) (*domain.PaymentCollection, error)
	GetCommissionReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.CommissionReport, error)
	GetAttendanceReport(ctx context.Context, tenantID string, filter ReportFilter) ([]domain.AttendanceRow, error)
	GetInventoryReport(ctx context.Context, tenantID string) (*domain.InventoryReport, error)
	GetPiutangReport(ctx context.Context, tenantID string, filter ReportFilter) (*domain.PiutangReport, error)
	GetFinancialStatement(ctx context.Context, tenantID string, filter ReportFilter) (*domain.FinancialStatement, error)
}

// Service implements the reports use cases (all read-only).
type Service struct {
	Repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{Repo: repo}
}

func (s *Service) Orders(ctx context.Context, tenantID string, f ReportFilter) (*domain.OrdersReport, error) {
	r, err := s.Repo.GetOrdersReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("orders report: %w", err)
	}
	return r, nil
}

func (s *Service) Revenue(ctx context.Context, tenantID string, f ReportFilter) (*domain.RevenueReport, error) {
	r, err := s.Repo.GetRevenueReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("revenue report: %w", err)
	}
	return r, nil
}

func (s *Service) Services(ctx context.Context, tenantID string, f ReportFilter) (*domain.ServicesReport, error) {
	r, err := s.Repo.GetServicesReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("services report: %w", err)
	}
	return r, nil
}

func (s *Service) Customers(ctx context.Context, tenantID string, f ReportFilter) (*domain.CustomersReport, error) {
	r, err := s.Repo.GetCustomersReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("customers report: %w", err)
	}
	return r, nil
}

func (s *Service) Expenses(ctx context.Context, tenantID string, f ReportFilter) (*domain.ExpensesReport, error) {
	r, err := s.Repo.GetExpensesReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("expenses report: %w", err)
	}
	return r, nil
}

func (s *Service) MonthlyPnL(ctx context.Context, tenantID string, month, year int) (*domain.MonthlyPnL, error) {
	r, err := s.Repo.GetMonthlyPnL(ctx, tenantID, month, year)
	if err != nil {
		return nil, fmt.Errorf("monthly pnl: %w", err)
	}
	return r, nil
}

func (s *Service) Profit(ctx context.Context, tenantID string, f ReportFilter) (*domain.ProfitReport, error) {
	r, err := s.Repo.GetProfitReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("profit report: %w", err)
	}
	return r, nil
}

func (s *Service) Outstanding(ctx context.Context, tenantID string, f ReportFilter) (*domain.OutstandingReport, error) {
	r, err := s.Repo.GetOutstandingReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("outstanding report: %w", err)
	}
	return r, nil
}

func (s *Service) PaymentCollection(ctx context.Context, tenantID string) (*domain.PaymentCollection, error) {
	r, err := s.Repo.GetPaymentCollection(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("payment collection: %w", err)
	}
	return r, nil
}

func (s *Service) Commission(ctx context.Context, tenantID string, f ReportFilter) (*domain.CommissionReport, error) {
	r, err := s.Repo.GetCommissionReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("commission report: %w", err)
	}
	return r, nil
}

func (s *Service) Attendance(ctx context.Context, tenantID string, f ReportFilter) ([]domain.AttendanceRow, error) {
	r, err := s.Repo.GetAttendanceReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("attendance report: %w", err)
	}
	return r, nil
}

func (s *Service) Inventory(ctx context.Context, tenantID string) (*domain.InventoryReport, error) {
	r, err := s.Repo.GetInventoryReport(ctx, tenantID)
	if err != nil {
		return nil, fmt.Errorf("inventory report: %w", err)
	}
	return r, nil
}

func (s *Service) Piutang(ctx context.Context, tenantID string, f ReportFilter) (*domain.PiutangReport, error) {
	r, err := s.Repo.GetPiutangReport(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("piutang report: %w", err)
	}
	return r, nil
}

func (s *Service) FinancialStatement(ctx context.Context, tenantID string, f ReportFilter) (*domain.FinancialStatement, error) {
	r, err := s.Repo.GetFinancialStatement(ctx, tenantID, f)
	if err != nil {
		return nil, fmt.Errorf("financial statement: %w", err)
	}
	return r, nil
}
