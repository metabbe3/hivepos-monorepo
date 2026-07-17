package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/hivepos/api/internal/modules/customers/application"
	"github.com/hivepos/api/internal/modules/customers/domain"
)

// fakeRepo implements application.Repository for unit tests.
type fakeRepo struct {
	customers  map[string]*domain.Customer
	byPhone    map[string]*domain.Customer
	byClient   map[string]*domain.Customer
	createErr  error
	findErr    error
	listOut    []*domain.Customer
	listTotal  int64
	listErr    error
	itemsOut   []*application.CustomerListItem
	itemsErr   error
	statsErr   error
	lastFilter application.ListFilter
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{customers: map[string]*domain.Customer{}, byPhone: map[string]*domain.Customer{}, byClient: map[string]*domain.Customer{}}
}

func (f *fakeRepo) Create(_ context.Context, c *domain.Customer) error {
	if f.createErr != nil {
		return f.createErr
	}
	c.ID = "cust-new"
	f.customers[c.ID] = c
	if c.Phone != nil {
		f.byPhone[*c.Phone] = c
	}
	return nil
}
func (f *fakeRepo) FindByID(_ context.Context, id, _ string) (*domain.Customer, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	return f.customers[id], nil
}
func (f *fakeRepo) FindByPhone(_ context.Context, phone, _ string) (*domain.Customer, error) {
	return f.byPhone[phone], nil
}
func (f *fakeRepo) FindByClientID(_ context.Context, clientID string) (*domain.Customer, error) {
	return f.byClient[clientID], nil
}
func (f *fakeRepo) List(_ context.Context, _ string, filter application.ListFilter) ([]*domain.Customer, int64, error) {
	f.lastFilter = filter
	return f.listOut, f.listTotal, f.listErr
}
func (f *fakeRepo) ListItems(_ context.Context, _ string, filter application.ListFilter) ([]*application.CustomerListItem, int64, error) {
	f.lastFilter = filter
	return f.itemsOut, f.listTotal, f.itemsErr
}
func (f *fakeRepo) Update(_ context.Context, _ *domain.Customer) error { return nil }
func (f *fakeRepo) Delete(_ context.Context, _, _ string) error        { return nil }
func (f *fakeRepo) GetStats(_ context.Context, _, _ string) (*domain.CustomerStats, error) {
	return nil, f.statsErr
}
func (f *fakeRepo) GetDeposits(_ context.Context, _, _ string) ([]*domain.DepositTransaction, error) {
	return nil, nil
}
func (f *fakeRepo) TopUpDeposit(_ context.Context, _, _ string, _ float64, _, _ string) (*domain.DepositTransaction, error) {
	return nil, nil
}

func TestCreate_Happy(t *testing.T) {
	s := application.NewService(newFakeRepo())
	ph := "0812"
	c, err := s.Create(context.Background(), application.CreateCustomerInput{Name: "A", Phone: &ph}, "t1", "b1")
	if err != nil || c == nil || c.ID != "cust-new" {
		t.Fatalf("Create happy: %v / %+v", err, c)
	}
}

func TestCreate_PhoneDuplicate(t *testing.T) {
	r := newFakeRepo()
	ph := "0812"
	r.byPhone[ph] = &domain.Customer{ID: "existing"}
	s := application.NewService(r)
	if _, err := s.Create(context.Background(), application.CreateCustomerInput{Name: "A", Phone: &ph}, "t1", "b1"); err == nil {
		t.Fatal("duplicate phone must error")
	}
}

func TestCreate_IdempotentViaClientID(t *testing.T) {
	r := newFakeRepo()
	cid := "client-1"
	existing := &domain.Customer{ID: "cust-existing"}
	r.byClient[cid] = existing
	s := application.NewService(r)
	got, err := s.Create(context.Background(), application.CreateCustomerInput{Name: "A", ClientID: &cid}, "t1", "b1")
	if err != nil || got.ID != "cust-existing" {
		t.Fatalf("idempotent must return existing: %v / %+v", err, got)
	}
}

func TestCreate_RepoError(t *testing.T) {
	r := newFakeRepo()
	r.createErr = errors.New("db")
	s := application.NewService(r)
	if _, err := s.Create(context.Background(), application.CreateCustomerInput{Name: "A"}, "t1", "b1"); err == nil {
		t.Fatal("repo error must surface")
	}
}

func TestGet_FoundAndNotFound(t *testing.T) {
	r := newFakeRepo()
	r.customers["c1"] = &domain.Customer{ID: "c1"}
	s := application.NewService(r)
	if got, err := s.Get(context.Background(), "c1", "t1"); err != nil || got == nil {
		t.Fatalf("Get found: %v/%+v", err, got)
	}
	if _, err := s.Get(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("Get missing must error")
	}
}

func TestList_Clamps(t *testing.T) {
	r := newFakeRepo()
	s := application.NewService(r)
	if _, _, err := s.List(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999}); err != nil {
		t.Fatal(err)
	}
	if r.lastFilter.Page != 1 || r.lastFilter.Limit != 20 {
		t.Fatalf("clamp = (%d,%d), want (1,20) [service resets >100→default]", r.lastFilter.Page, r.lastFilter.Limit)
	}
}

// deriveCustomerStatus edge cases — mirrors the TS test suite.
func TestDeriveCustomerStatus(t *testing.T) {
	now := time.Date(2026, 7, 8, 0, 0, 0, 0, time.UTC)
	thirty := 30 * 24 * time.Hour
	ninety := 90 * 24 * time.Hour

	cases := []struct {
		name    string
		created time.Time
		last    *time.Time
		orders  int64
		want    string
	}{
		{"NEW (recent, 0 orders)", now.Add(-5 * 24 * time.Hour), nil, 0, "NEW"},
		{"LAPSED (old, no orders)", now.Add(-ninety - time.Hour), nil, 0, "LAPSED"},
		{"ACTIVE (≤30d)", now.Add(-ninety), ptr(now.Add(-3 * 24 * time.Hour)), 5, "ACTIVE"},
		{"AT_RISK (30–90d)", now.Add(-ninety), ptr(now.Add(-45 * 24 * time.Hour)), 2, "AT_RISK"},
		{"LAPSED (>90d)", now.Add(-ninety), ptr(now.Add(-95 * 24 * time.Hour)), 1, "LAPSED"},
		{"recent reg + has order → ACTIVE not NEW", now.Add(-5 * 24 * time.Hour), ptr(now.Add(-1 * 24 * time.Hour)), 1, "ACTIVE"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := application.DeriveCustomerStatus(c.created, c.last, c.orders, now); got != c.want {
				t.Fatalf("got %q, want %q", got, c.want)
			}
		})
	}
	_ = thirty
}

func ptr[T any](v T) *T { return &v }
