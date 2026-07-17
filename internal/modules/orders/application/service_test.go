package application_test

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/hivepos/api/internal/modules/orders/application"
	"github.com/hivepos/api/internal/modules/orders/domain"
)

// fakeRepo implements application.Repository entirely in-memory.
type fakeRepo struct {
	orders     map[string]*domain.Order
	byClient   map[string]*domain.Order
	createErr  error
	findErr    error
	listOut    []*domain.Order
	listTotal  int64
	listErr    error
	statusErr  error
	deleteErr  error
	lastFilter application.ListFilter
	lastCreate *domain.Order
}

func newFakeRepo() *fakeRepo {
	return &fakeRepo{orders: map[string]*domain.Order{}, byClient: map[string]*domain.Order{}}
}

func (f *fakeRepo) Create(_ context.Context, order *domain.Order, _ []domain.OrderItem) error {
	if f.createErr != nil {
		return f.createErr
	}
	order.ID = "order-new"
	f.orders[order.ID] = order
	f.lastCreate = order
	if order.ClientID != nil {
		f.byClient[*order.ClientID] = order
	}
	return nil
}
func (f *fakeRepo) FindByID(_ context.Context, id, _ string) (*domain.Order, error) {
	if f.findErr != nil {
		return nil, f.findErr
	}
	return f.orders[id], nil
}
func (f *fakeRepo) FindDetailByID(_ context.Context, _, _ string) (*application.OrderDetail, error) {
	return &application.OrderDetail{}, nil
}
func (f *fakeRepo) FindByClientID(_ context.Context, clientID string) (*domain.Order, error) {
	return f.byClient[clientID], nil
}
func (f *fakeRepo) List(_ context.Context, _ string, filter application.ListFilter) ([]*domain.Order, int64, error) {
	f.lastFilter = filter
	return f.listOut, f.listTotal, f.listErr
}
func (f *fakeRepo) ListItems(_ context.Context, _ string, filter application.ListFilter) ([]*application.OrderListItem, int64, error) {
	f.lastFilter = filter
	return nil, f.listTotal, f.listErr
}
func (f *fakeRepo) UpdateStatus(_ context.Context, _, _ string, _ domain.OrderStatus) error {
	return f.statusErr
}
func (f *fakeRepo) Delete(_ context.Context, _, _ string) error { return f.deleteErr }

func (f *fakeRepo) Update(_ context.Context, _, _ string, _ application.UpdateOrderInput) (*domain.Order, error) {
	return &domain.Order{}, nil
}
func (f *fakeRepo) RecordPayment(_ context.Context, _, _ string, _ float64, _, _ string, _ *time.Time) (*domain.Order, error) {
	return &domain.Order{}, nil
}
func (f *fakeRepo) VoidPayment(_ context.Context, _, _, _ string) (*domain.Order, error) {
	return &domain.Order{}, nil
}

func svc() (*application.Service, *fakeRepo) {
	r := newFakeRepo()
	return application.NewService(r), r
}

func TestCreate_Happy(t *testing.T) {
	s, r := svc()
	w := 2.5
	in := application.CreateOrderInput{
		CustomerID: "c1",
		Items: []application.OrderItemInput{
			{ServiceID: "s1", Quantity: 2, WeightKg: &w},
		},
		Notes: "fragile",
	}
	got, err := s.Create(context.Background(), in, "t1", "b1", "u1", nil)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.ID != "order-new" {
		t.Fatalf("ID = %q", got.ID)
	}
	if got.Status != domain.StatusReceived || got.PaymentStatus != domain.PaymentPending {
		t.Fatalf("default status wrong: %+v", got)
	}
	if got.TenantID != "t1" || got.BranchID != "b1" || got.Module != "LAUNDRY" {
		t.Fatalf("tenant/branch/module not stamped: %+v", got)
	}
	if got.Notes != "fragile" {
		t.Fatalf("notes lost: %q", got.Notes)
	}
	if r.lastCreate == nil {
		t.Fatal("repo.Create not invoked")
	}
}

func TestCreate_IdempotentViaClientID(t *testing.T) {
	s, r := svc()
	existing := &domain.Order{ID: "order-existing", TenantID: "t1"}
	cid := "client-abc"
	r.byClient[cid] = existing

	got, err := s.Create(context.Background(), application.CreateOrderInput{CustomerID: "c1", Items: []application.OrderItemInput{{ServiceID: "s1", Quantity: 1}}}, "t1", "b1", "u1", &cid)
	if err != nil {
		t.Fatalf("Create: %v", err)
	}
	if got.ID != "order-existing" {
		t.Fatalf("idempotent must return existing order, got %q", got.ID)
	}
	if r.lastCreate != nil {
		t.Fatal("repo.Create must NOT be called on idempotent hit")
	}
}

func TestCreate_RepoError(t *testing.T) {
	s, r := svc()
	r.createErr = errors.New("db down")
	_, err := s.Create(context.Background(), application.CreateOrderInput{CustomerID: "c1", Items: []application.OrderItemInput{{ServiceID: "s1", Quantity: 1}}}, "t1", "b1", "u1", nil)
	if err == nil {
		t.Fatal("want error on repo failure")
	}
}

func TestGet_HappyAndNotFound(t *testing.T) {
	s, r := svc()
	r.orders["o1"] = &domain.Order{ID: "o1", TenantID: "t1"}

	got, err := s.Get(context.Background(), "o1", "t1")
	if err != nil || got == nil || got.ID != "o1" {
		t.Fatalf("Get existing: got=%+v err=%v", got, err)
	}

	if _, err := s.Get(context.Background(), "missing", "t1"); err == nil {
		t.Fatal("Get missing must error")
	}
}

func TestGet_RepoError(t *testing.T) {
	s, r := svc()
	r.findErr = errors.New("scan failed")
	if _, err := s.Get(context.Background(), "o1", "t1"); err == nil {
		t.Fatal("want error on repo failure")
	}
}

func TestList_PaginationClamps(t *testing.T) {
	cases := []struct {
		name              string
		inPage, inLimit   int
		wantPage, wantLim int
	}{
		{"zero defaults", 0, 0, 1, 20},
		{"negative", -3, -1, 1, 20},
		{"valid", 2, 50, 2, 50},
		{"max boundary", 1, 100, 1, 100},
		{"over max resets to default", 1, 101, 1, 20},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			s, r := svc()
			r.listTotal = 0
			if _, _, err := s.List(context.Background(), "t1", application.ListFilter{Page: c.inPage, Limit: c.inLimit}); err != nil {
				t.Fatalf("List: %v", err)
			}
			if r.lastFilter.Page != c.wantPage || r.lastFilter.Limit != c.wantLim {
				t.Fatalf("filter = (page=%d,limit=%d), want (%d,%d)", r.lastFilter.Page, r.lastFilter.Limit, c.wantPage, c.wantLim)
			}
		})
	}
}

func TestList_PassesThroughResult(t *testing.T) {
	s, r := svc()
	r.listOut = []*domain.Order{{ID: "a"}, {ID: "b"}}
	r.listTotal = 42
	out, total, err := s.List(context.Background(), "t1", application.ListFilter{Page: 1, Limit: 10})
	if err != nil {
		t.Fatalf("List: %v", err)
	}
	if total != 42 || len(out) != 2 {
		t.Fatalf("got %d items, total %d", len(out), total)
	}
}

func TestList_RepoError(t *testing.T) {
	s, r := svc()
	r.listErr = errors.New("boom")
	if _, _, err := s.List(context.Background(), "t1", application.ListFilter{}); err == nil {
		t.Fatal("want error on repo failure")
	}
}

func TestListItems_ClampsAndCallsRepo(t *testing.T) {
	s, r := svc()
	r.listTotal = 7
	if _, total, err := s.ListItems(context.Background(), "t1", application.ListFilter{Page: 0, Limit: 999}); err != nil {
		t.Fatalf("ListItems: %v", err)
	} else if total != 7 {
		t.Fatalf("total = %d", total)
	}
	// Limit>100 resets to 20 (matches the inline clamp, not Normalize's 100 cap).
	if r.lastFilter.Page != 1 || r.lastFilter.Limit != 20 {
		t.Fatalf("clamp = (page=%d,limit=%d), want (1,20)", r.lastFilter.Page, r.lastFilter.Limit)
	}
}
