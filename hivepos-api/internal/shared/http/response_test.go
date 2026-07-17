package http_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	apphttp "github.com/hivepos/api/internal/shared/http"
)

func decodeBody(t *testing.T, rec *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&m); err != nil {
		t.Fatalf("decode: %v (body: %s)", err, rec.Body.String())
	}
	return m
}

func TestSuccessAndMeta(t *testing.T) {
	rec := httptest.NewRecorder()
	apphttp.Success(rec, []string{"a"}, map[string]any{"total": 1})
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); ct != "application/json" {
		t.Fatalf("content-type = %q", ct)
	}
	m := decodeBody(t, rec)
	if m["success"] != true {
		t.Fatal("success not true")
	}
	meta, _ := m["meta"].(map[string]any)
	if meta["total"] != float64(1) {
		t.Fatalf("meta missing: %+v", m)
	}
}

func TestSuccessNilMetaOmitted(t *testing.T) {
	rec := httptest.NewRecorder()
	apphttp.Success(rec, "x")
	m := decodeBody(t, rec)
	if _, ok := m["meta"]; ok {
		t.Fatal("meta should be omitted when nil")
	}
}

func TestCreated(t *testing.T) {
	rec := httptest.NewRecorder()
	apphttp.Created(rec, map[string]int{"id": 7})
	if rec.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201", rec.Code)
	}
}

func TestNoContent(t *testing.T) {
	rec := httptest.NewRecorder()
	apphttp.NoContent(rec)
	// NoContent returns 200 + {success:true} envelope, NOT 204 — the web's apiFetch
	// rejects empty 204 bodies, and bare 204 breaks every delete button.
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}
}

func TestErrorCarriesCode(t *testing.T) {
	cases := []struct {
		name string
		fn   func(w http.ResponseWriter, msg string)
		want int
		code string
	}{
		{"validation", apphttp.ValidationError, http.StatusBadRequest, "VALIDATION_ERROR"},
		{"notfound", apphttp.NotFoundError, http.StatusNotFound, "NOT_FOUND"},
		{"forbidden", apphttp.ForbiddenError, http.StatusForbidden, "FORBIDDEN"},
		{"unauthorized", apphttp.UnauthorizedError, http.StatusUnauthorized, "UNAUTHENTICATED"},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			c.fn(rec, "msg")
			if rec.Code != c.want {
				t.Fatalf("status = %d, want %d", rec.Code, c.want)
			}
			errObj, _ := decodeBody(t, rec)["error"].(map[string]any)
			if errObj["code"] != c.code {
				t.Fatalf("code = %v, want %s", errObj["code"], c.code)
			}
			if errObj["message"] != "msg" {
				t.Fatalf("message = %v", errObj["message"])
			}
		})
	}
}

func TestErrorGenericStatus(t *testing.T) {
	rec := httptest.NewRecorder()
	apphttp.Error(rec, http.StatusInternalServerError, "boom")
	if rec.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d", rec.Code)
	}
	errObj, _ := decodeBody(t, rec)["error"].(map[string]any)
	if errObj["code"] != "INTERNAL_ERROR" {
		t.Fatalf("code = %v, want INTERNAL_ERROR", errObj["code"])
	}
}

// Empty lists must serialize as [] (TS apiSuccess), not null.
func TestSuccessNilSliceIsJSONArray(t *testing.T) {
	var nilSlice []*struct{ ID string }
	rec := httptest.NewRecorder()
	apphttp.Success(rec, nilSlice)
	body := rec.Body.String()
	if !strings.Contains(body, `"data":[]`) {
		t.Fatalf("nil slice must marshal as [], got: %s", body)
	}
}
