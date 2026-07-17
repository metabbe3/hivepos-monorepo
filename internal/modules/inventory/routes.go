package inventory

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/inventory/application"
	"github.com/hivepos/api/internal/modules/inventory/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the inventory domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgStockItemRepository(db)
	return &Module{svc: application.NewService(repo)}
}

func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Patch("/", m.update)
		r.Delete("/", m.delete)
		r.Get("/movements", m.listMovements)
		r.Post("/movements", m.addMovement)
	})
}

func (m *Module) list(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	filter := application.ListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		Search:   req.URL.Query().Get("search"),
		Active:   req.URL.Query().Get("active"),
		LowOnly:  req.URL.Query().Get("lowOnly"),
	}
	// /api/stock-items is intentionally unpaginated (matches the original TS contract).
	filter.All = true
	list, _, err := m.svc.List(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// TS /api/stock-items returns the list unpaginated (no meta).
	apphttp.Success(w, list)
}

func (m *Module) create(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	if tenantID == "" || branchID == "" {
		apphttp.ForbiddenError(w, "Missing tenant/branch context")
		return
	}
	var input application.CreateStockItemInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Name == "" {
		apphttp.ValidationError(w, "name is required")
		return
	}
	if input.Unit == "" {
		apphttp.ValidationError(w, "unit is required")
		return
	}
	item, err := m.svc.Create(req.Context(), input, tenantID, branchID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, item)
}

func (m *Module) update(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	item, err := m.svc.Get(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Stock item not found")
		return
	}
	if !decodeJSON(w, req, item) {
		return
	}
	item.ID = id
	if err := m.svc.Update(req.Context(), item); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, item)
}

func (m *Module) delete(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.Delete(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func (m *Module) listMovements(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	// Verify ownership before listing movements.
	if _, err := m.svc.Get(req.Context(), id, middleware.GetTenantID(req)); err != nil {
		apphttp.NotFoundError(w, "Stock item not found")
		return
	}
	list, err := m.svc.ListMovements(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}

func (m *Module) addMovement(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	if _, err := m.svc.Get(req.Context(), id, middleware.GetTenantID(req)); err != nil {
		apphttp.NotFoundError(w, "Stock item not found")
		return
	}
	var input application.CreateMovementInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Type == "" {
		apphttp.ValidationError(w, "type is required")
		return
	}
	if input.Quantity == 0 {
		apphttp.ValidationError(w, "quantity must be non-zero")
		return
	}
	movement, err := m.svc.AddMovement(req.Context(), id, middleware.GetTenantID(req), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, movement)
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(req.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
