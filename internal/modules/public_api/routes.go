package publicapi

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/modules/public_api/application"
	"github.com/hivepos/api/internal/modules/public_api/domain"
	"github.com/hivepos/api/internal/modules/public_api/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the public API domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

// NewModule constructs the module. db is passed as interface{} and cast to *sql.DB,
// matching the convention used by every other module.
func NewModule(db interface{}) *Module {
	repo := infrastructure.NewPgPublicRepository(db.(*sql.DB))
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the public-API sub-router.
// ponytail: medium — public endpoints resolved by slug; add API-key rate limiting when abuse occurs.
func (m *Module) Register(r chi.Router) {
	r.Get("/branches", m.listBranches)
	r.Get("/services", m.listServices)
	r.Post("/tickets", m.createTicket)
	r.Get("/orders/track", m.trackOrder)
	r.Post("/pickup-requests", m.createPickupRequest)
}

// resolveSlug returns the tenant slug from the X-Tenant-Slug header OR the ?slug query param.
func resolveSlug(req *http.Request) string {
	if s := req.Header.Get("X-Tenant-Slug"); s != "" {
		return strings.TrimSpace(s)
	}
	return strings.TrimSpace(req.URL.Query().Get("slug"))
}

func (m *Module) listBranches(w http.ResponseWriter, req *http.Request) {
	slug := resolveSlug(req)
	if slug == "" {
		apphttp.ValidationError(w, "slug (tenant slug) is required — pass ?slug= or X-Tenant-Slug header")
		return
	}
	branches, err := m.svc.ListBranches(req.Context(), slug)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, branches)
}

func (m *Module) listServices(w http.ResponseWriter, req *http.Request) {
	slug := resolveSlug(req)
	if slug == "" {
		apphttp.ValidationError(w, "slug (tenant slug) is required — pass ?slug= or X-Tenant-Slug header")
		return
	}
	branchID := req.URL.Query().Get("branchId")
	services, err := m.svc.ListServices(req.Context(), slug, branchID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{
		"services": services,
	})
}

func (m *Module) createTicket(w http.ResponseWriter, req *http.Request) {
	var input domain.TicketInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.Name == "" || input.Email == "" || input.Message == "" {
		apphttp.ValidationError(w, "name, email, and message are required")
		return
	}

	id, err := m.svc.SubmitTicket(req.Context(), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, map[string]interface{}{
		"ticketId": id,
		"status":   "OPEN",
	})
}

func (m *Module) trackOrder(w http.ResponseWriter, req *http.Request) {
	orderNumber := req.URL.Query().Get("orderNumber")
	if orderNumber == "" {
		apphttp.ValidationError(w, "orderNumber is required")
		return
	}
	// phone is optional verification — only the last 4 chars are used.
	phoneLast4 := req.URL.Query().Get("phone")

	order, err := m.svc.TrackOrder(req.Context(), orderNumber, phoneLast4)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if order == nil {
		apphttp.NotFoundError(w, "Order not found")
		return
	}
	apphttp.Success(w, order)
}

func (m *Module) createPickupRequest(w http.ResponseWriter, req *http.Request) {
	var input domain.PickupInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.Name == "" || input.Phone == "" {
		apphttp.ValidationError(w, "name and phone are required")
		return
	}
	// Slug may come from the body or the header/query (body wins).
	if input.TenantSlug == "" {
		input.TenantSlug = resolveSlug(req)
	}
	if input.TenantSlug == "" {
		apphttp.ValidationError(w, "tenantSlug is required")
		return
	}

	id, err := m.svc.RequestPickup(req.Context(), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, map[string]interface{}{
		"requestId": id,
		"status":    "PENDING",
	})
}
