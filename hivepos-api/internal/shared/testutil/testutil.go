// Package testutil holds shared helpers for unit tests: claim-injected requests
// (so auth/tenant middleware passes without a real JWT), envelope decoding, and
// status assertions. Imported only from *_test.go files.
package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	appauth "github.com/hivepos/api/internal/auth"
)

// Claims builds a populated *appauth.Claims for tests. Defaults UserID; pass the
// values the handler under test reads.
func Claims(role, tenantID, branchID string, perms ...string) *appauth.Claims {
	return &appauth.Claims{
		UserID:      "user-test",
		Role:        role,
		TenantID:    tenantID,
		BranchID:    branchID,
		Permissions: perms,
	}
}

// RequestWithClaims builds a request whose context carries claims, so
// RequireAuth/RequireTenant/RequirePermission pass without signing a JWT.
// body may be nil.
func RequestWithClaims(tb testing.TB, method, target string, body []byte, c *appauth.Claims) *http.Request {
	tb.Helper()
	var r *http.Request
	var err error
	if body != nil {
		r, err = http.NewRequest(method, target, bytes.NewReader(body))
	} else {
		r, err = http.NewRequest(method, target, nil)
	}
	if err != nil {
		tb.Fatalf("build request: %v", err)
	}
	if body != nil {
		r.Header.Set("Content-Type", "application/json")
	}
	if c != nil {
		r = r.WithContext(context.WithValue(r.Context(), appauth.ClaimsKey, c))
	}
	return r
}

// AssertStatus fails if the recorder status differs from want.
func AssertStatus(tb testing.TB, rec *httptest.ResponseRecorder, want int) {
	tb.Helper()
	if rec.Code != want {
		tb.Fatalf("status = %d, want %d (body: %s)", rec.Code, want, rec.Body.String())
	}
}

// Decode unmarshals body into a map[string]any.
func Decode(tb testing.TB, r io.Reader) map[string]any {
	tb.Helper()
	var m map[string]any
	if err := json.NewDecoder(r).Decode(&m); err != nil {
		tb.Fatalf("decode body: %v", err)
	}
	return m
}

// AssertErrorCode fails unless the error envelope carries the expected code.
func AssertErrorCode(tb testing.TB, rec *httptest.ResponseRecorder, wantCode string) {
	tb.Helper()
	body := Decode(tb, rec.Body)
	errObj, ok := body["error"].(map[string]any)
	if !ok {
		tb.Fatalf("no error object in response: %s", rec.Body.String())
	}
	if got, _ := errObj["code"].(string); got != wantCode {
		tb.Fatalf("error.code = %q, want %q (body: %s)", got, wantCode, rec.Body.String())
	}
}
