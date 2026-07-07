package router

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// New creates the main API router with all middleware chains.
// Domain route groups are registered separately (internal/modules/*/routes.go).
func New() chi.Router {
	r := chi.NewRouter()

	// Global middleware
	r.Use(chimw.RequestID)
	r.Use(chimw.RealIP)
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)

	// Health check (no auth)
	r.Get("/api/health", healthHandler)

	// API v1 group — all authenticated routes go under here.
	// Each module registers its own sub-router via Register(r).
	// Example:
	//   r.Route("/api/v1/orders", orders.RegisterRoutes)
	//   r.Route("/api/v1/customers", customers.RegisterRoutes)

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

// JSONBody decodes a JSON request body into dst. Returns false if decoding failed
// (the error response is already written).
func JSONBody(w http.ResponseWriter, r *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(r.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
