package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/hivepos/api/internal/modules/reports/application"
	"github.com/hivepos/api/internal/modules/reports/domain"
)

// fakeRepo stubs all 14 report methods; each surfaces `err` and records the last
// filter on the Orders path. Report services are thin delegates, so the tests
// verify delegation + error wrapping.
type fakeRepo struct {
	orders *domain.OrdersReport
	err    error
	last   application.ReportFilter
}

func (f *fakeRepo) GetOrdersReport(_ context.Context, _ string, fl application.ReportFilter) (*domain.OrdersReport, error) {
	f.last = fl
	if f.err != nil {
		return nil, f.err
	}
	if f.orders != nil {
		return f.orders, nil
	}
	return &domain.OrdersReport{}, nil
}
func (f *fakeRepo) GetRevenueReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.RevenueReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.RevenueReport{}, nil
}
func (f *fakeRepo) GetServicesReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.ServicesReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.ServicesReport{}, nil
}
func (f *fakeRepo) GetCustomersReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.CustomersReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.CustomersReport{}, nil
}
func (f *fakeRepo) GetExpensesReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.ExpensesReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.ExpensesReport{}, nil
}
func (f *fakeRepo) GetMonthlyPnL(_ context.Context, _ string, _, _ int) (*domain.MonthlyPnL, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.MonthlyPnL{}, nil
}
func (f *fakeRepo) GetProfitReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.ProfitReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.ProfitReport{}, nil
}
func (f *fakeRepo) GetOutstandingReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.OutstandingReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.OutstandingReport{}, nil
}
func (f *fakeRepo) GetPaymentCollection(_ context.Context, _ string) (*domain.PaymentCollection, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.PaymentCollection{}, nil
}
func (f *fakeRepo) GetCommissionReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.CommissionReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.CommissionReport{}, nil
}
func (f *fakeRepo) GetAttendanceReport(_ context.Context, _ string, _ application.ReportFilter) ([]domain.AttendanceRow, error) {
	return nil, f.err
}
func (f *fakeRepo) GetInventoryReport(_ context.Context, _ string) (*domain.InventoryReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.InventoryReport{}, nil
}
func (f *fakeRepo) GetPiutangReport(_ context.Context, _ string, _ application.ReportFilter) (*domain.PiutangReport, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.PiutangReport{}, nil
}
func (f *fakeRepo) GetFinancialStatement(_ context.Context, _ string, _ application.ReportFilter) (*domain.FinancialStatement, error) {
	if f.err != nil {
		return nil, f.err
	}
	return &domain.FinancialStatement{}, nil
}

func TestOrders_DelegatesAndForwardsFilter(t *testing.T) {
	r := &fakeRepo{orders: &domain.OrdersReport{}}
	got, err := application.NewService(r).Orders(context.Background(), "t1", application.ReportFilter{StartDate: "2026-01-01"})
	if err != nil || got == nil {
		t.Fatalf("Orders delegate: %v / %+v", err, got)
	}
	if r.last.StartDate != "2026-01-01" {
		t.Fatalf("filter not forwarded: %+v", r.last)
	}
}

func TestReport_ErrorWrapping(t *testing.T) {
	r := &fakeRepo{err: errors.New("db")}
	cases := []func() error{
		func() error {
			_, e := application.NewService(r).Orders(context.Background(), "t1", application.ReportFilter{})
			return e
		},
		func() error {
			_, e := application.NewService(r).Revenue(context.Background(), "t1", application.ReportFilter{})
			return e
		},
		func() error {
			_, e := application.NewService(r).MonthlyPnL(context.Background(), "t1", 7, 2026)
			return e
		},
		func() error { _, e := application.NewService(r).Inventory(context.Background(), "t1"); return e },
	}
	for i, c := range cases {
		if c() == nil {
			t.Fatalf("case %d must surface wrapped error", i)
		}
	}
}
