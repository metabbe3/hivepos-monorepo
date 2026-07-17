package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	appauth "github.com/hivepos/api/internal/auth"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/shared/testutil"
)

func okHandler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusOK) })
}

func serve(t *testing.T, h http.Handler, req *http.Request) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestRequireAuth(t *testing.T) {
	h := middleware.RequireAuth(okHandler())

	// no claims → 401
	rec := serve(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/x", nil, nil))
	testutil.AssertStatus(t, rec, http.StatusUnauthorized)

	// with claims → 200
	rec = serve(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/x", nil,
		testutil.Claims("STAFF", "t1", "b1")))
	testutil.AssertStatus(t, rec, http.StatusOK)
}

func TestRequirePermission(t *testing.T) {
	h := middleware.RequirePermission("orders", "read")(okHandler())

	cases := []struct {
		name   string
		claims *appauth.Claims
		want   int
	}{
		{"nil claims → 401", nil, http.StatusUnauthorized},
		{"super admin bypass", testutil.Claims("SUPER_ADMIN", "t1", "b1"), http.StatusOK},
		{"exact perm", testutil.Claims("STAFF", "t1", "b1", "orders:read"), http.StatusOK},
		{"wildcard", testutil.Claims("STAFF", "t1", "b1", "*"), http.StatusOK},
		{"missing perm → 403", testutil.Claims("STAFF", "t1", "b1", "customers:read"), http.StatusForbidden},
		{"empty perms → 403", testutil.Claims("STAFF", "t1", "b1"), http.StatusForbidden},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := serve(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/x", nil, c.claims))
			testutil.AssertStatus(t, rec, c.want)
		})
	}
}

func TestRequireTenant(t *testing.T) {
	// nil claims → 403
	h := middleware.RequireTenant(okHandler())
	rec := serve(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/x", nil, nil))
	testutil.AssertStatus(t, rec, http.StatusForbidden)

	// empty tenant → 403
	rec = serve(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/x", nil,
		testutil.Claims("STAFF", "", "b1")))
	testutil.AssertStatus(t, rec, http.StatusForbidden)

	// valid → 200 and context carries tenant/branch/user
	var gotTenant, gotBranch, gotUser string
	h2 := middleware.RequireTenant(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotTenant = middleware.GetTenantID(r)
		gotBranch = middleware.GetBranchID(r)
		gotUser = middleware.GetUserID(r)
		w.WriteHeader(http.StatusOK)
	}))
	rec = serve(t, h2, testutil.RequestWithClaims(t, http.MethodGet, "/x", nil,
		testutil.Claims("STAFF", "tenant-9", "branch-2")))
	testutil.AssertStatus(t, rec, http.StatusOK)
	if gotTenant != "tenant-9" || gotBranch != "branch-2" || gotUser != "user-test" {
		t.Fatalf("ctx IDs = (%q,%q,%q)", gotTenant, gotBranch, gotUser)
	}
}

func TestGetIDs_FallsBackToClaims(t *testing.T) {
	// Without RequireTenant having run, Get*ID should still read claims directly.
	var tenant, branch, user string
	h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		tenant = middleware.GetTenantID(r)
		branch = middleware.GetBranchID(r)
		user = middleware.GetUserID(r)
		w.WriteHeader(http.StatusOK)
	})
	rec := serve(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/x", nil,
		testutil.Claims("STAFF", "t-fb", "b-fb")))
	testutil.AssertStatus(t, rec, http.StatusOK)
	if tenant != "t-fb" || branch != "b-fb" || user != "user-test" {
		t.Fatalf("fallback IDs = (%q,%q,%q)", tenant, branch, user)
	}
}

func TestRequireResource(t *testing.T) {
	cases := []struct {
		name   string
		method string
		role   string
		perms  []string
		want   int
	}{
		{"nil claims → 401", http.MethodGet, "", nil, http.StatusUnauthorized},
		{"super admin bypass", http.MethodGet, "SUPER_ADMIN", nil, http.StatusOK},
		{"exact read", http.MethodGet, "STAFF", []string{"orders:read"}, http.StatusOK},
		{"read perm but POST → 403 (needs create)", http.MethodPost, "STAFF", []string{"orders:read"}, http.StatusForbidden},
		{"edit via PATCH", http.MethodPatch, "STAFF", []string{"orders:edit"}, http.StatusOK},
		{"delete via DELETE", http.MethodDelete, "STAFF", []string{"orders:delete"}, http.StatusOK},
		{"wildcard grants all", http.MethodDelete, "STAFF", []string{"*"}, http.StatusOK},
		{"wrong resource perm → 403", http.MethodGet, "STAFF", []string{"customers:read"}, http.StatusForbidden},
		{"empty perms → 403", http.MethodGet, "STAFF", nil, http.StatusForbidden},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var claims *appauth.Claims
			if c.role != "" || c.perms != nil {
				claims = testutil.Claims(c.role, "t1", "b1", c.perms...)
				if c.role == "" {
					// still need a non-nil claims object but with empty role for the
					// "empty perms" case; testutil.Claims sets role from arg.
					claims.Role = c.role
				}
			}
			h := middleware.RequireResource("orders")(okHandler())
			rec := serve(t, h, testutil.RequestWithClaims(t, c.method, "/orders", nil, claims))
			testutil.AssertStatus(t, rec, c.want)
		})
	}
}

func TestRequireResource_ForbidsWithCode(t *testing.T) {
	h := middleware.RequireResource("orders")(okHandler())
	rec := serve(t, h, testutil.RequestWithClaims(t, http.MethodGet, "/orders", nil,
		testutil.Claims("STAFF", "t1", "b1", "customers:read")))
	testutil.AssertStatus(t, rec, http.StatusForbidden)
	testutil.AssertErrorCode(t, rec, "FORBIDDEN")
}
