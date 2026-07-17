package application_test

import (
	"context"
	"errors"
	"testing"

	"github.com/hivepos/api/internal/modules/expenses/application"
	"github.com/hivepos/api/internal/modules/expenses/domain"
)

type fakeRepo struct {
	expenses   map[string]*domain.Expense
	createErr  error
	lastFlt    application.ListFilter
	lastCatFlt application.CategoryListFilter
	listTotal  int64
}

func newFakeRepo() *fakeRepo { return &fakeRepo{expenses: map[string]*domain.Expense{}} }

func (f *fakeRepo) CreateExpense(_ context.Context, e *domain.Expense) error {
	if f.createErr != nil {
		return f.createErr
	}
	e.ID = "exp-new"
	f.expenses[e.ID] = e
	return nil
}
func (f *fakeRepo) FindExpenseByID(_ context.Context, id, _ string) (*domain.Expense, error) {
	return f.expenses[id], nil
}
func (f *fakeRepo) ListExpenses(_ context.Context, _ string, fl application.ListFilter) ([]*domain.Expense, int64, error) {
	f.lastFlt = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) UpdateExpense(_ context.Context, _ *domain.Expense) error          { return nil }
func (f *fakeRepo) DeleteExpense(_ context.Context, _, _ string) error                { return nil }
func (f *fakeRepo) CreateCategory(_ context.Context, _ *domain.ExpenseCategory) error { return nil }
func (f *fakeRepo) FindCategoryByID(_ context.Context, _, _ string) (*domain.ExpenseCategory, error) {
	return nil, nil
}
func (f *fakeRepo) ListCategories(_ context.Context, _ string, fl application.CategoryListFilter) ([]*domain.ExpenseCategory, int64, error) {
	f.lastCatFlt = fl
	return nil, f.listTotal, nil
}
func (f *fakeRepo) UpdateCategory(_ context.Context, _ *domain.ExpenseCategory) error { return nil }
func (f *fakeRepo) DeleteCategory(_ context.Context, _, _ string) error               { return nil }

func TestCreateExpense_StampsBranch(t *testing.T) {
	e, err := application.NewService(newFakeRepo()).CreateExpense(
		context.Background(), application.CreateExpenseInput{Amount: 5000}, "t1", "b1")
	if err != nil || e.BranchID != "b1" {
		t.Fatalf("CreateExpense: %v / %+v", err, e)
	}
}

func TestCreateExpense_RepoError(t *testing.T) {
	r := newFakeRepo()
	r.createErr = errors.New("db")
	if _, err := application.NewService(r).CreateExpense(context.Background(), application.CreateExpenseInput{Amount: 1}, "t1", "b1"); err == nil {
		t.Fatal("want error")
	}
}

func TestGetExpense_NotFound(t *testing.T) {
	if _, err := application.NewService(newFakeRepo()).GetExpense(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("missing expense must error")
	}
}

func TestListExpenses_ClampsTo100(t *testing.T) {
	r := newFakeRepo()
	if _, _, err := application.NewService(r).ListExpenses(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999}); err != nil {
		t.Fatal(err)
	}
	if r.lastFlt.Page != 1 || r.lastFlt.Limit != 100 {
		t.Fatalf("clamp = (%d,%d), want (1,100)", r.lastFlt.Page, r.lastFlt.Limit)
	}
}

func TestGetCategory_NotFound(t *testing.T) {
	if _, err := application.NewService(newFakeRepo()).GetCategory(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("missing category must error")
	}
}

func TestListCategories_Clamps(t *testing.T) {
	r := newFakeRepo()
	application.NewService(r).ListCategories(context.Background(), "t1", application.CategoryListFilter{Page: -1, Limit: 0})
	if r.lastCatFlt.Page != 1 || r.lastCatFlt.Limit != 100 {
		t.Fatalf("clamp = (%d,%d)", r.lastCatFlt.Page, r.lastCatFlt.Limit)
	}
}
