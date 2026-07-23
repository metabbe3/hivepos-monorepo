package orders

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	appauth "github.com/hivepos/api/internal/auth"
	"github.com/hivepos/api/internal/modules/orders/application"
	"github.com/hivepos/api/internal/modules/orders/domain"
	"github.com/hivepos/api/internal/shared/testutil"
)

// rfake is a tiny application.Repository for HTTP-level tests.
type rfake struct {
	orders    map[string]*domain.Order
	listOut   []*domain.Order
	listTotal int64
	statusErr error
}

func (f *rfake) Create(_ context.Context, o *domain.Order, _ []domain.OrderItem) error {
	o.ID = "order-new"
	f.orders[o.ID] = o
	return nil
}
func (f *rfake) FindByID(_ context.Context, id, _ string) (*domain.Order, error) {
	return f.orders[id], nil
}
func (f *rfake) FindDetailByID(_ context.Context, id, _ string) (*application.OrderDetail, error) {
	if _, ok := f.orders[id]; !ok {
		return nil, nil // not found
	}
	return &application.OrderDetail{ID: id}, nil
}
func (f *rfake) FindByClientID(_ context.Context, _ string) (*domain.Order, error) { return nil, nil }
func (f *rfake) List(_ context.Context, _ string, _ application.ListFilter) ([]*domain.Order, int64, error) {
	return f.listOut, f.listTotal, nil
}
func (f *rfake) ListItems(_ context.Context, _ string, _ application.ListFilter) ([]*application.OrderListItem, int64, error) {
	return nil, f.listTotal, nil
}
func (f *rfake) UpdateStatus(_ context.Context, _, _ string, _ domain.OrderStatus) error {
	return f.statusErr
}
func (f *rfake) Delete(_ context.Context, _, _ string) error { return nil }
func (f *rfake) Update(_ context.Context, _, _ string, _ application.UpdateOrderInput) (*domain.Order, error) {
	return &domain.Order{}, nil
}
func (f *rfake) RecordPayment(_ context.Context, _, _ string, _ float64, _, _ string, _ *time.Time) (*domain.Order, error) {
	return &domain.Order{}, nil
}
func (f *rfake) VoidPayment(_ context.Context, _, _, _ string) (*domain.Order, error) {
	return &domain.Order{}, nil
}

func setupRouter(t *testing.T, f *rfake) http.Handler {
	t.Helper()
	m := &Module{svc: application.NewService(f)}
	r := chi.NewRouter()
	r.Route("/orders", m.Register)
	return r
}

func claimsWith(role, tenantID, branchID string, perms ...string) *appauth.Claims {
	return testutil.Claims(role, tenantID, branchID, perms...)
}

func do(t *testing.T, h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestList_WithTenant(t *testing.T) {
	f := &rfake{orders: map[string]*domain.Order{}, listOut: []*domain.Order{{ID: "a"}}, listTotal: 1}
	h := setupRouter(t, f)

	req := testutil.RequestWithClaims(t, http.MethodGet, "/orders?page=2&limit=10", nil, claimsWith("STAFF", "t1", "b1"))
	rec := do(t, h, req)
	testutil.AssertStatus(t, rec, http.StatusOK)
	body := testutil.Decode(t, rec.Body)
	meta, _ := body["meta"].(map[string]any)
	// TS orders meta = { total, page, totalPages } (no limit).
	if meta["page"] != float64(2) || meta["total"] != float64(1) || meta["totalPages"] == nil {
		t.Fatalf("meta wrong: %+v", meta)
	}
	if _, has := meta["limit"]; has {
		t.Fatalf("orders meta must not include limit: %+v", meta)
	}
}

func TestList_NoTenant_Forbidden(t *testing.T) {
	f := &rfake{orders: map[string]*domain.Order{}}
	h := setupRouter(t, f)
	// nil claims → GetTenantID returns "" → 403
	rec := do(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/orders", nil, nil))
	testutil.AssertStatus(t, rec, http.StatusForbidden)
	testutil.AssertErrorCode(t, rec, "FORBIDDEN")
}

func TestCreate_Validation(t *testing.T) {
	f := &rfake{orders: map[string]*domain.Order{}}
	h := setupRouter(t, f)
	c := claimsWith("STAFF", "t1", "b1")

	// missing customerId
	rec := do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders",
		[]byte(`{"items":[{"serviceId":"s1","quantity":1}]}`), c))
	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")

	// customerId not UUID-shaped (customers.id is gen_random_uuid()::text)
	rec = do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders",
		[]byte(`{"customerId":"not-a-uuid","items":[{"serviceId":"s1","quantity":1}]}`), c))
	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")

	// missing items
	rec = do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders",
		[]byte(`{"customerId":"11111111-1111-1111-1111-111111111111"}`), c))
	testutil.AssertStatus(t, rec, http.StatusBadRequest)

	// bad JSON
	rec = do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders",
		[]byte(`{not-json`), c))
	testutil.AssertStatus(t, rec, http.StatusBadRequest)
}

func TestCreate_MissingBranch_Forbidden(t *testing.T) {
	f := &rfake{orders: map[string]*domain.Order{}}
	h := setupRouter(t, f)
	// tenant present, branch empty → handler requires both
	rec := do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders",
		[]byte(`{"customerId":"11111111-1111-1111-1111-111111111111","items":[{"serviceId":"s1","quantity":1}]}`), claimsWith("STAFF", "t1", "")))
	testutil.AssertStatus(t, rec, http.StatusForbidden)
}

func TestCreate_Happy(t *testing.T) {
	f := &rfake{orders: map[string]*domain.Order{}}
	h := setupRouter(t, f)
	rec := do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders",
		[]byte(`{"customerId":"11111111-1111-1111-1111-111111111111","items":[{"serviceId":"s1","quantity":2}]}`), claimsWith("STAFF", "t1", "b1")))
	testutil.AssertStatus(t, rec, http.StatusCreated)
}

func TestGetByID_FoundAndNotFound(t *testing.T) {
	f := &rfake{orders: map[string]*domain.Order{"o1": {ID: "o1", TenantID: "t1"}}}
	h := setupRouter(t, f)

	rec := do(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/orders/o1", nil, claimsWith("STAFF", "t1", "b1")))
	testutil.AssertStatus(t, rec, http.StatusOK)

	rec = do(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/orders/missing", nil, claimsWith("STAFF", "t1", "b1")))
	testutil.AssertStatus(t, rec, http.StatusNotFound)
	testutil.AssertErrorCode(t, rec, "NOT_FOUND")
}

func TestAdvanceStatus(t *testing.T) {
	f := &rfake{orders: map[string]*domain.Order{}}
	h := setupRouter(t, f)

	// ok
	rec := do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders/o1/status",
		[]byte(`{"status":"READY"}`), claimsWith("STAFF", "t1", "b1")))
	testutil.AssertStatus(t, rec, http.StatusOK)

	// repo error → 400 (advance-status surfaces business-rule errors as VALIDATION_ERROR)
	f.statusErr = errors.New("boom")
	rec = do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders/o1/status",
		[]byte(`{"status":"READY"}`), claimsWith("STAFF", "t1", "b1")))
	testutil.AssertStatus(t, rec, http.StatusBadRequest)
	testutil.AssertErrorCode(t, rec, "VALIDATION_ERROR")

	// bad JSON
	f.statusErr = nil
	rec = do(t, h, testutil.RequestWithClaims(t, http.MethodPost, "/orders/o1/status",
		[]byte(`{bad`), claimsWith("STAFF", "t1", "b1")))
	testutil.AssertStatus(t, rec, http.StatusBadRequest)
}
