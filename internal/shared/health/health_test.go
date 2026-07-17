package health_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/hivepos/api/internal/shared/health"
)

// nil DB → 503 + degraded/down. (The "up" path needs a reachable Postgres and
// is covered by the runtime parity check, not a unit test.)
func TestHandlerNilDB_Down(t *testing.T) {
	rec := httptest.NewRecorder()
	health.Handler(nil).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/health", nil))

	if rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("nil db status = %d, want 503", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, `"db":"down"`) {
		t.Fatalf("nil db must report db=down: %s", body)
	}
	if !strings.Contains(body, `"status":"degraded"`) {
		t.Fatalf("nil db must report status=degraded: %s", body)
	}
	if !strings.Contains(body, `"ts":"`) {
		t.Fatalf("missing ts field: %s", body)
	}
}
