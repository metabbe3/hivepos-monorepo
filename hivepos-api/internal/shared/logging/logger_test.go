package logging_test

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/hivepos/api/internal/shared/logging"
)

func TestSetup(t *testing.T) {
	// Setup only reconfigures the default handler; it must not panic and must
	// leave FromCtx functional. (No log calls here → no stdout noise.)
	logging.Setup("production")
	logging.Setup("development")
	if logging.FromCtx(context.Background()) == nil {
		t.Fatal("FromCtx nil after Setup")
	}
}

func TestWithLoggerRoundTrip(t *testing.T) {
	var buf bytes.Buffer
	l := slog.New(slog.NewTextHandler(&buf, nil))
	out := logging.FromCtx(logging.WithLogger(context.Background(), l))
	if out == nil {
		t.Fatal("FromCtx returned nil")
	}
	out.Info("captured")
	if !strings.Contains(buf.String(), "captured") {
		t.Fatalf("injected logger did not write: %s", buf.String())
	}
	// WithLogger(nil) is a no-op (does not overwrite ctx).
	if logging.WithLogger(context.Background(), nil) == nil {
		t.Fatal("WithLogger(nil) returned nil ctx")
	}
}

func TestFromCtxAttachesRequestID(t *testing.T) {
	var buf bytes.Buffer
	slog.SetDefault(slog.New(slog.NewTextHandler(&buf, nil)))

	rec := httptest.NewRecorder()
	h := middleware.RequestID(http.HandlerFunc(func(_ http.ResponseWriter, r *http.Request) {
		logging.FromCtx(r.Context()).Info("hit")
	}))
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Request-Id", "req-xyz")
	h.ServeHTTP(rec, req)

	out := buf.String()
	if !strings.Contains(out, "request_id") || !strings.Contains(out, "req-xyz") {
		t.Fatalf("request_id not attached to log: %s", out)
	}
}
