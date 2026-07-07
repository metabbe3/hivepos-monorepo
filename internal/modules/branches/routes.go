package branches

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"github.com/hivepos/api/internal/modules/branches/application"
	"github.com/hivepos/api/internal/modules/branches/infrastructure"
	"github.com/hivepos/api/internal/middleware"
)

// Module wires the branches domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgBranchRepository(db)
	return &Module{svc: application.NewService(repo)}
}

func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getByID)
		r.Patch("/", m.update)
		r.Delete("/", m.delete)
	})
}

func (m *Module) list(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	filter := application.ListFilter{
		Search: req.URL.Query().Get("search"),
		Active: req.URL.Query().Get("active"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		filter.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		filter.Limit = l
	}
	list, total, err := m.svc.List(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
}

func (m *Module) create(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	var input application.CreateInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Name == "" {
		apphttp.ValidationError(w, "name is required")
		return
	}
	b, err := m.svc.Create(req.Context(), input, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, b)
}

func (m *Module) getByID(w http.ResponseWriter, req *http.Request) {
	b, err := m.svc.Get(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Branch not found")
		return
	}
	apphttp.Success(w, b)
}

func (m *Module) update(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	b, err := m.svc.Get(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Branch not found")
		return
	}
	if !decodeJSON(w, req, b) {
		return
	}
	b.ID = id
	if err := m.svc.Update(req.Context(), b); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, b)
}

func (m *Module) delete(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.Delete(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(req.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
