package users

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/users/application"
	"github.com/hivepos/api/internal/modules/users/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the users domain: repository -> service -> HTTP handlers.
// Covers both /users and /roles endpoints.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgUserRepository(db)
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the users + roles sub-routers.
// The caller mounts this Module under both /api/users and /api/roles.
// To support that, Register exposes two distinct route trees that the host
// can mount independently via RegisterUsers / RegisterRoles.
func (m *Module) Register(r chi.Router) {
	m.RegisterUsers(r)
	m.RegisterRoles(r)
}

// RegisterUsers mounts the /users endpoints. Mount under /api/users.
func (m *Module) RegisterUsers(r chi.Router) {
	r.Get("/", m.listUsers)
	r.Post("/", m.createUser)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getUser)
		r.Patch("/", m.updateUser)
		r.Delete("/", m.deleteUser)
		r.Patch("/pin", m.setPIN)
	})
}

// RegisterRoles mounts the /roles endpoints. Mount under /api/roles.
func (m *Module) RegisterRoles(r chi.Router) {
	r.Get("/", m.listRoles)
	r.Post("/", m.createRole)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getRole)
		r.Patch("/", m.updateRole)
		r.Delete("/", m.deleteRole)
	})
}

// ====================
// Users
// ====================

func (m *Module) listUsers(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	f := application.ListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		Search:   req.URL.Query().Get("search"),
		Role:     req.URL.Query().Get("role"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		f.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		f.Limit = l
	}

	list, total, err := m.svc.ListUsers(req.Context(), tenantID, f)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, map[string]interface{}{
		"total": total,
		"page":  f.Page,
		"limit": f.Limit,
	})
}

func (m *Module) createUser(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	var input application.CreateUserInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.BranchID == "" {
		input.BranchID = middleware.GetBranchID(req)
	}

	u, err := m.svc.CreateUser(req.Context(), input, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, u)
}

func (m *Module) getUser(w http.ResponseWriter, req *http.Request) {
	u, err := m.svc.GetUser(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "User not found")
		return
	}
	apphttp.Success(w, u)
}

func (m *Module) updateUser(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var upd application.UpdateUserInput
	if err := json.NewDecoder(req.Body).Decode(&upd); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	if err := m.svc.UpdateUser(req.Context(), id, tenantID, upd); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true})
}

func (m *Module) deleteUser(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteUser(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func (m *Module) setPIN(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var input application.SetPINInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	if err := m.svc.SetPIN(req.Context(), id, tenantID, input); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true})
}

// ====================
// Roles
// ====================

func (m *Module) listRoles(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	f := application.ListFilter{Search: req.URL.Query().Get("search")}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		f.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		f.Limit = l
	}

	list, total, err := m.svc.ListRoles(req.Context(), tenantID, f)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, map[string]interface{}{
		"total": total,
		"page":  f.Page,
		"limit": f.Limit,
	})
}

func (m *Module) createRole(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	var input application.CreateRoleInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	role, err := m.svc.CreateRole(req.Context(), input, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, role)
}

func (m *Module) getRole(w http.ResponseWriter, req *http.Request) {
	role, err := m.svc.GetRole(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Role not found")
		return
	}
	apphttp.Success(w, role)
}

func (m *Module) updateRole(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var upd application.UpdateRoleInput
	if err := json.NewDecoder(req.Body).Decode(&upd); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	if err := m.svc.UpdateRole(req.Context(), id, tenantID, upd); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true})
}

func (m *Module) deleteRole(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteRole(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}
