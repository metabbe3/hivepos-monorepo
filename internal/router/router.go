package router

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// New creates the main API router with all middleware chains.
func New() chi.Router {
	return NewWithMiddleware()
}

// NewWithMiddleware creates the router with optional extra middleware (e.g. JWT).
// ALL middleware must be registered BEFORE routes (chi requirement).
func NewWithMiddleware(extra ...func(http.Handler) http.Handler) chi.Router {
	r := chi.NewRouter()

	// Global middleware (before any routes)
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	for _, m := range extra {
		r.Use(m)
	}

	// Health check (no auth)
	r.Get("/api/health", healthHandler)

	return r
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	apphttp.Success(w, map[string]interface{}{
		"status":  "ok",
		"service": "hivepos-api",
		"version": "0.1.0",
	})
}

// ModuleRouter is the interface each domain module implements to register its routes.
type ModuleRouter interface {
	Register(r chi.Router)
}

// JSONBody decodes a JSON request body into dst. Returns false if decoding failed.
func JSONBody(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
