package apperror_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/hivepos/api/internal/shared/apperror"
)

func TestConstructors(t *testing.T) {
	cases := []struct {
		name       string
		err        *apperror.Error
		wantStatus int
		wantCode   apperror.Code
	}{
		{"validation", apperror.NewValidation("bad"), http.StatusBadRequest, apperror.Validation},
		{"validation+details", apperror.NewValidation("bad", apperror.FieldError{Field: "name", Message: "required"}), http.StatusBadRequest, apperror.Validation},
		{"invalidinput", apperror.NewInvalidInput("x"), http.StatusBadRequest, apperror.InvalidInput},
		{"unauth default msg", apperror.NewUnauthenticated(""), http.StatusUnauthorized, apperror.Unauthenticated},
		{"forbidden custom", apperror.NewForbidden("nope"), http.StatusForbidden, apperror.Forbidden},
		{"insufficient perm", apperror.NewInsufficientPermission("orders", "read"), http.StatusForbidden, apperror.InsufficientPermission},
		{"notfound with id", apperror.NewNotFound("Order", "123"), http.StatusNotFound, apperror.NotFound},
		{"notfound no id", apperror.NewNotFound("Order", ""), http.StatusNotFound, apperror.NotFound},
		{"conflict", apperror.NewConflict("dup"), http.StatusConflict, apperror.Conflict},
		{"business", apperror.NewBusinessRule("nope"), http.StatusBadRequest, apperror.BusinessRule},
		{"internal", apperror.NewInternal("boom", errors.New("root")), http.StatusInternalServerError, apperror.Internal},
		{"database", apperror.NewDatabase("db down", errors.New("conn")), http.StatusInternalServerError, apperror.Database},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if c.err.Status != c.wantStatus {
				t.Errorf("status = %d, want %d", c.err.Status, c.wantStatus)
			}
			if c.err.Code != c.wantCode {
				t.Errorf("code = %s, want %s", c.err.Code, c.wantCode)
			}
		})
	}
}

func TestInsufficientPermissionMessage(t *testing.T) {
	e := apperror.NewInsufficientPermission("orders", "read")
	if e.Message != "Missing permission: orders:read" {
		t.Fatalf("message = %q", e.Message)
	}
}

func TestAs_UnwrapsWrapped(t *testing.T) {
	base := apperror.NewNotFound("Order", "1")
	wrapped := errors.Join(errors.New("ctx"), base) // errors.As walks the chain
	if apperror.As(wrapped) != base {
		t.Fatal("As must find the *Error inside a wrapped chain")
	}
	if apperror.As(errors.New("plain")) != nil {
		t.Fatal("As must return nil for a non-apperror")
	}
}

func TestErrorStringIncludesCode(t *testing.T) {
	s := apperror.NewInternal("boom", errors.New("root")).Error()
	if !strings.Contains(s, "[INTERNAL_ERROR]") || !strings.Contains(s, "boom") {
		t.Fatalf("Error() missing code/message: %q", s)
	}
}

func TestWrite_EnvelopAndCode(t *testing.T) {
	apperror.SetProduction(false)
	rec := httptest.NewRecorder()
	apperror.Write(rec, apperror.NewValidation("bad", apperror.FieldError{Field: "name", Message: "required"}))

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec.Code)
	}
	var body struct {
		Success bool `json:"success"`
		Error   struct {
			Code    string                `json:"code"`
			Message string                `json:"message"`
			Details []apperror.FieldError `json:"details"`
		} `json:"error"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	if body.Success || body.Error.Code != "VALIDATION_ERROR" {
		t.Fatalf("envelope wrong: %+v", body)
	}
	if len(body.Error.Details) != 1 || body.Error.Details[0].Field != "name" {
		t.Fatalf("details missing: %+v", body.Error.Details)
	}
}

func TestWrite_ProductionRedacts5xx(t *testing.T) {
	apperror.SetProduction(true)
	defer apperror.SetProduction(false)

	rec := httptest.NewRecorder()
	apperror.Write(rec, apperror.NewInternal("DB connection refused leaked", errors.New("root")))
	var body struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&body)
	if body.Error.Message != "Internal server error" {
		t.Fatalf("prod 5xx must be redacted, got %q", body.Error.Message)
	}
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
}

func TestWrite_DevShowsInternalMessage(t *testing.T) {
	apperror.SetProduction(false)
	rec := httptest.NewRecorder()
	apperror.Write(rec, apperror.NewInternal("keep this detail", nil))
	var body struct {
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&body)
	if body.Error.Message != "keep this detail" {
		t.Fatalf("dev must show real message, got %q", body.Error.Message)
	}
}

func TestWrite_UnknownErrorBecomesInternal(t *testing.T) {
	apperror.SetProduction(false)
	rec := httptest.NewRecorder()
	apperror.Write(rec, errors.New("anything"))
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", rec.Code)
	}
}

func TestDecodeJSON(t *testing.T) {
	// valid body
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(`{"a":"b"}`))
	var dst struct{ A string }
	if !apperror.DecodeJSON(rec, req, &dst) {
		t.Fatal("expected ok=true for valid JSON")
	}
	if dst.A != "b" {
		t.Fatalf("decoded A = %q", dst.A)
	}
	if rec.Code != 200 { // nothing written on success
		t.Fatalf("unexpected write on success: %d", rec.Code)
	}

	// invalid body → 400 + false, dst untouched path returns false
	rec2 := httptest.NewRecorder()
	req2 := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(`{not json`))
	if apperror.DecodeJSON(rec2, req2, &dst) {
		t.Fatal("expected ok=false for invalid JSON")
	}
	if rec2.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", rec2.Code)
	}
}
