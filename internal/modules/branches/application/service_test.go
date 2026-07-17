package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/hivepos/api/internal/modules/branches/application"
	"github.com/hivepos/api/internal/modules/branches/domain"
)

type fakeRepo struct {
	branches  map[string]*domain.Branch
	createErr error
	lastFlt   application.ListFilter
	listTotal int64
}

func newFakeRepo() *fakeRepo { return &fakeRepo{branches: map[string]*domain.Branch{}} }

func (f *fakeRepo) Create(_ context.Context, b *domain.Branch) error {
	if f.createErr != nil {
		return f.createErr
	}
	b.ID = "br-new"
	f.branches[b.ID] = b
	return nil
}
func (f *fakeRepo) FindByID(_ context.Context, id, _ string) (*domain.Branch, error) {
	return f.branches[id], nil
}
func (f *fakeRepo) List(_ context.Context, _ string, fl application.ListFilter) ([]*domain.Branch, int64, error) {
	f.lastFlt = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) ListItems(_ context.Context, _ string, fl application.ListFilter) ([]*application.BranchListItem, error) {
	f.lastFlt = fl
	return nil, nil
}
func (f *fakeRepo) Update(_ context.Context, _ *domain.Branch) error { return nil }
func (f *fakeRepo) Delete(_ context.Context, _, _ string) error      { return nil }

func TestCreate_AppliesDefaults(t *testing.T) {
	b, err := application.NewService(newFakeRepo()).Create(context.Background(), application.CreateInput{Name: "Outlet"}, "t1")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if b.PrinterPort != 9100 || b.PrinterPaperSize != "58mm" || !b.IsActive || b.TenantID != "t1" {
		t.Fatalf("defaults wrong: %+v", b)
	}
	if len(b.WorkDays) != 6 {
		t.Fatalf("WorkDays default = %v", b.WorkDays)
	}
}

func TestCreate_RespectsExplicitPrinterPort(t *testing.T) {
	port := 9200
	pp := "80mm"
	b, _ := application.NewService(newFakeRepo()).Create(context.Background(), application.CreateInput{Name: "X", PrinterPort: &port, PrinterPaperSize: &pp}, "t1")
	if b.PrinterPort != 9200 || b.PrinterPaperSize != "80mm" {
		t.Fatalf("explicit values not kept: %+v", b)
	}
}

func TestCreate_RepoError(t *testing.T) {
	r := newFakeRepo()
	r.createErr = errors.New("db")
	if _, err := application.NewService(r).Create(context.Background(), application.CreateInput{Name: "X"}, "t1"); err == nil {
		t.Fatal("want error")
	}
}

func TestGet_NotFound(t *testing.T) {
	if _, err := application.NewService(newFakeRepo()).Get(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("missing branch must error")
	}
}

func TestList_ClampsTo100(t *testing.T) {
	r := newFakeRepo()
	if _, _, err := application.NewService(r).List(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999}); err != nil {
		t.Fatal(err)
	}
	if r.lastFlt.Page != 1 || r.lastFlt.Limit != 100 {
		t.Fatalf("clamp = (%d,%d), want (1,100)", r.lastFlt.Page, r.lastFlt.Limit)
	}
}
