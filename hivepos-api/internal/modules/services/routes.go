package services

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/services/application"
	"github.com/hivepos/api/internal/modules/services/infrastructure"
	"github.com/hivepos/api/internal/shared/apperror"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"github.com/hivepos/api/internal/shared/pagination"
)

// Module wires the services domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgServiceRepository(db)
	return &Module{svc: application.NewService(repo)}
}

// Register mounts both /api/services and /api/service-groups sub-routers.
func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getByID)
		r.Patch("/", m.update)
		r.Delete("/", m.delete)
	})
}

// RegisterGroups mounts the /api/service-groups sub-router separately.
// Call this from main with a route group dedicated to service-groups.
func (m *Module) RegisterGroups(r chi.Router) {
	r.Get("/", m.listGroups)
	r.Post("/", m.createGroup)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getGroupByID)
		r.Patch("/", m.updateGroup)
		r.Delete("/", m.deleteGroup)
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
		Module:   req.URL.Query().Get("module"),
		Search:   req.URL.Query().Get("search"),
		Active:   req.URL.Query().Get("active"),
		GroupID:  req.URL.Query().Get("groupId"),
	}
	// /api/services is intentionally unpaginated (matches the original TS contract):
	// return every active/inactive row for the tenant. ponytail: add a hard cap
	// (e.g. LIMIT 1000) only if a tenant's catalog ever grows past a few hundred.
	filter.All = true
	list, _, err := m.svc.ListItems(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// TS /api/services returns the curated DTO list unpaginated (no meta).
	apphttp.Success(w, list)
}

func (m *Module) create(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	if tenantID == "" || branchID == "" {
		apphttp.ForbiddenError(w, "Missing tenant/branch context")
		return
	}
	var input application.CreateServiceInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Name == "" {
		apphttp.ValidationError(w, "name is required")
		return
	}
	s, err := m.svc.Create(req.Context(), input, tenantID, branchID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, s)
}

func (m *Module) getByID(w http.ResponseWriter, req *http.Request) {
	s, err := m.svc.Get(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Service not found")
		return
	}
	apphttp.Success(w, s)
}

func (m *Module) update(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	s, err := m.svc.Get(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Service not found")
		return
	}
	// Security: decode into a restricted input (NOT the full entity) to prevent
	// mass assignment — a body like {"branchId":"<other-tenant-branch>"} must NOT
	// move the service cross-tenant. Preserve the original ID + BranchID.
	var input application.CreateServiceInput
	if !decodeJSON(w, req, &input) {
		return
	}
	// Partial-update semantics: only overwrite fields the body actually supplies.
	// The web's edit dialog sends a partial body (e.g. a rename omits pricingType/module),
	// and the DB-layer enum coerce was removed (8a3202a) — so blindly assigning
	// input.PricingType = "" 500'd with SQLSTATE 22P02 (invalid enum ""). Empty/zero/nil
	// → keep the existing value. This is also correct PATCH semantics.
	if input.Name != "" {
		s.Name = input.Name
	}
	if input.Description != nil {
		s.Description = input.Description
	}
	if input.PricingType != "" {
		s.PricingType = input.PricingType
	}
	if input.BasePrice != 0 {
		s.BasePrice = input.BasePrice
	}
	if input.CommissionType != "" {
		s.CommissionType = input.CommissionType
	}
	if input.CommissionValue != 0 {
		s.CommissionValue = input.CommissionValue
	}
	if input.Module != "" {
		s.Module = input.Module
	}
	if input.GroupID != nil {
		s.GroupID = input.GroupID
	}
	if input.IsActive != nil {
		s.IsActive = *input.IsActive
	}
	if input.IsDefaultSpeed != nil {
		s.IsDefaultSpeed = *input.IsDefaultSpeed
	}
	s.ID = id
	// BranchID preserved from the original Get (tenant-scoped) — never from the body.
	if err := m.svc.Update(req.Context(), s); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, s)
}

func (m *Module) delete(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.Delete(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apperror.Write(w, err)
		return
	}
	apphttp.NoContent(w)
}

// --- Service Groups ---

func (m *Module) listGroups(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	filter := application.ListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		Module:   req.URL.Query().Get("module"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		filter.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		filter.Limit = l
	}
	filter.Page, filter.Limit, _ = pagination.Normalize(filter.Page, filter.Limit)
	list, _, err := m.svc.ListGroups(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// TS /api/service-groups returns the list unpaginated (no meta).
	apphttp.Success(w, list)
}

func (m *Module) createGroup(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	if tenantID == "" || branchID == "" {
		apphttp.ForbiddenError(w, "Missing tenant/branch context")
		return
	}
	var input application.CreateGroupInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Name == "" {
		apphttp.ValidationError(w, "name is required")
		return
	}
	g, err := m.svc.CreateGroup(req.Context(), input, tenantID, branchID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, g)
}

func (m *Module) getGroupByID(w http.ResponseWriter, req *http.Request) {
	g, err := m.svc.GetGroup(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Service group not found")
		return
	}
	apphttp.Success(w, g)
}

func (m *Module) updateGroup(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	g, err := m.svc.GetGroup(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Service group not found")
		return
	}
	if !decodeJSON(w, req, g) {
		return
	}
	g.ID = id
	if err := m.svc.UpdateGroup(req.Context(), g); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, g)
}

func (m *Module) deleteGroup(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteGroup(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
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
