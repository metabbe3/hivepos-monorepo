package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/hivepos/api/internal/modules/reports/application"
	"github.com/hivepos/api/internal/modules/reports/domain"
)

// Edge cases for the report endpoints — empty results, nil repos, error propagation,
// boundary date filters.
func TestReport_EmptyResults(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	out, err := s.Orders(context.Background(), "t1", application.ReportFilter{})
	if err != nil {
		t.Fatalf("Orders empty: %v", err)
	}
	if out == nil {
		t.Fatal("expected non-nil report")
	}
}

func TestReport_RepoError(t *testing.T) {
	r := &fakeRepo{err: errors.New("connection refused")}
	s := application.NewService(r)
	if _, err := s.Orders(context.Background(), "t1", application.ReportFilter{}); err == nil {
		t.Fatal("Orders must surface error")
	}
	if _, err := s.Revenue(context.Background(), "t1", application.ReportFilter{}); err == nil {
		t.Fatal("Revenue must surface error")
	}
	if _, err := s.Profit(context.Background(), "t1", application.ReportFilter{}); err == nil {
		t.Fatal("Profit must surface error")
	}
	if _, err := s.MonthlyPnL(context.Background(), "t1", 1, 2026); err == nil {
		t.Fatal("MonthlyPnL must surface error")
	}
	if _, err := s.Outstanding(context.Background(), "t1", application.ReportFilter{}); err == nil {
		t.Fatal("Outstanding must surface error")
	}
}

func TestReport_EmptyTenantID(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	out, err := s.Orders(context.Background(), "", application.ReportFilter{})
	if err != nil {
		t.Fatalf("Orders empty tenant: %v", err)
	}
	if out == nil {
		t.Fatal("expected non-nil report")
	}
}

func TestReport_BoundaryDates(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	_, err := s.Orders(context.Background(), "t1", application.ReportFilter{
		BranchID:  "b1",
		StartDate: "2026-01-01",
		EndDate:   "2026-12-31",
	})
	if err != nil {
		t.Fatalf("boundary dates: %v", err)
	}
	if r.last.StartDate != "2026-01-01" || r.last.EndDate != "2026-12-31" {
		t.Fatalf("filter not forwarded: %+v", r.last)
	}
}

func TestReport_MonthlyPnLDefaults(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	_, err := s.MonthlyPnL(context.Background(), "t1", 0, 0)
	if err != nil {
		t.Fatalf("MonthlyPnL default month/year: %v", err)
	}
}

func TestReport_InventoryEmpty(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	out, err := s.Inventory(context.Background(), "t1")
	if err != nil {
		t.Fatalf("Inventory empty: %v", err)
	}
	if out == nil {
		t.Fatal("expected non-nil report")
	}
}

func TestReport_PiutangEmpty(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	out, err := s.Piutang(context.Background(), "t1", application.ReportFilter{})
	if err != nil {
		t.Fatalf("Piutang empty: %v", err)
	}
	if out == nil {
		t.Fatal("expected non-nil report")
	}
}

func TestReport_FinancialStatementEmpty(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	out, err := s.FinancialStatement(context.Background(), "t1", application.ReportFilter{})
	if err != nil {
		t.Fatalf("FinancialStatement empty: %v", err)
	}
	if out == nil {
		t.Fatal("expected non-nil report")
	}
}

func TestReport_PaymentCollectionEmpty(t *testing.T) {
	r := &fakeRepo{}
	s := application.NewService(r)
	out, err := s.PaymentCollection(context.Background(), "t1")
	if err != nil {
		t.Fatalf("PaymentCollection empty: %v", err)
	}
	if out == nil {
		t.Fatal("expected non-nil report")
	}
}

func TestReport_OrdersWithPopulatedData(t *testing.T) {
	r := &fakeRepo{orders: &domain.OrdersReport{
		Summary: domain.OrdersSummary{TotalOrders: 5},
	}}
	s := application.NewService(r)
	out, err := s.Orders(context.Background(), "t1", application.ReportFilter{})
	if err != nil {
		t.Fatalf("Orders populated: %v", err)
	}
	if out.Summary.TotalOrders != 5 {
		t.Fatalf("expected 5 orders, got %d", out.Summary.TotalOrders)
	}
}
