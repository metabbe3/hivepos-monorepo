package router

import (
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/hivepos/api/internal/shared/health"
)

// New creates the main API router with global middleware. The DB handle backs
// the /api/health check; extra middleware (e.g. CORS, JWT) is registered BEFORE
// routes (chi requirement).
func New(db *sql.DB, extra ...func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	// Global middleware (before any routes)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(pathOnlyLogger) // custom: logs r.URL.Path only (no query — amounts/PII never in access log)
	r.Use(chimw.Recoverer)
	for _, m := range extra {
		r.Use(m)
	}

	// Health check (no auth) — DB-aware.
	r.Get("/api/health", health.Handler(db))

	return r
}

// pathOnlyLogger logs method + path (NO query string) + status + duration.
// Replaces chimw.Logger which logs the full URL (could expose amounts/ids in query params).
func pathOnlyLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := chimw.NewWrapResponseWriter(w, r.ProtoMajor)
		next.ServeHTTP(ww, r)
		slog.Info("request",
			"method", r.Method,
			"path", r.URL.Path, // NOT r.URL.String() — query params redacted
			"status", ww.Status(),
			"bytes", ww.BytesWritten(),
			"ms", time.Since(start).Milliseconds(),
		)
	})
}

// ModuleRouter is the interface each domain module implements to register its routes.
type ModuleRouter interface {
	Register(r chi.Router)
}
