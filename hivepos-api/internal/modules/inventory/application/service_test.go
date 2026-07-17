package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/hivepos/api/internal/modules/inventory/application"
	"github.com/hivepos/api/internal/modules/inventory/domain"
)

type fakeRepo struct {
	items     map[string]*domain.StockItem
	createErr error
	lastFlt   application.ListFilter
	listTotal int64
	moveErr   error
}

func newFakeRepo() *fakeRepo { return &fakeRepo{items: map[string]*domain.StockItem{}} }

func (f *fakeRepo) Create(_ context.Context, s *domain.StockItem) error {
	if f.createErr != nil {
		return f.createErr
	}
	s.ID = "item-new"
	f.items[s.ID] = s
	return nil
}
func (f *fakeRepo) FindByID(_ context.Context, id, _ string) (*domain.StockItem, error) {
	return f.items[id], nil
}
func (f *fakeRepo) List(_ context.Context, _ string, fl application.ListFilter) ([]*domain.StockItem, int64, error) {
	f.lastFlt = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) Update(_ context.Context, _ *domain.StockItem) error { return nil }
func (f *fakeRepo) Delete(_ context.Context, _, _ string) error         { return nil }
func (f *fakeRepo) ListMovements(_ context.Context, _, _ string) ([]*domain.StockMovement, error) {
	return nil, nil
}
func (f *fakeRepo) AddMovement(_ context.Context, _, _ string, _ application.CreateMovementInput) (*domain.StockMovement, error) {
	return &domain.StockMovement{ID: "mv-new"}, f.moveErr
}

func TestCreate_Defaults(t *testing.T) {
	it, err := application.NewService(newFakeRepo()).Create(
		context.Background(), application.CreateStockItemInput{Name: "Detergent", Unit: "L"}, "t1", "b1")
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if !it.IsActive || it.CurrentQuantity != 0 || it.LowStockThreshold != 0 || it.PurchasePricePerUnit != 0 || it.BranchID != "b1" {
		t.Fatalf("defaults wrong: %+v", it)
	}
}

func TestCreate_RespectsExplicit(t *testing.T) {
	qty := 10.0
	low := 2.0
	it, _ := application.NewService(newFakeRepo()).Create(context.Background(),
		application.CreateStockItemInput{Name: "X", Unit: "u", CurrentQuantity: &qty, LowStockThreshold: &low}, "t1", "b1")
	if it.CurrentQuantity != 10 || it.LowStockThreshold != 2 {
		t.Fatalf("explicit values not kept: %+v", it)
	}
}

func TestCreate_RepoError(t *testing.T) {
	r := newFakeRepo()
	r.createErr = errors.New("db")
	if _, err := application.NewService(r).Create(context.Background(), application.CreateStockItemInput{Name: "X"}, "t1", "b1"); err == nil {
		t.Fatal("want error")
	}
}

func TestGet_NotFound(t *testing.T) {
	if _, err := application.NewService(newFakeRepo()).Get(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("missing item must error")
	}
}

func TestList_Clamps(t *testing.T) {
	r := newFakeRepo()
	application.NewService(r).List(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999})
	if r.lastFlt.Page != 1 || r.lastFlt.Limit != 100 {
		t.Fatalf("clamp = (%d,%d), want (1,100) [>200→100]", r.lastFlt.Page, r.lastFlt.Limit)
	}
}
