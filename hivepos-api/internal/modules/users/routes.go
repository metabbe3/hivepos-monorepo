package users

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/users/application"
	"github.com/hivepos/api/internal/modules/users/infrastructure"
	"github.com/hivepos/api/internal/planlimits"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the users domain: repository -> service -> HTTP handlers.
// Covers both /users and /roles endpoints.
type Module struct {
	svc *application.Service
	db  *sql.DB
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgUserRepository(db)
	return &Module{svc: application.NewService(repo), db: db}
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
		r.With(middleware.RequirePermission("users", "edit")).Post("/reset-password", m.resetUserPassword)
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
	// Intentionally unpaginated (matches the original TS contract).
	f.All = true

	// TS /api/users returns the curated DTO list unpaginated (no meta).
	list, _, err := m.svc.ListUserItems(req.Context(), tenantID, f)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
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

	if m.db != nil {
		if r, _ := planlimits.Check(req.Context(), m.db, tenantID, planlimits.Users); r != nil && !r.Allowed {
			apphttp.Error(w, http.StatusForbidden, fmt.Sprintf("%s limit reached (%d/%d) on the %s plan. Upgrade to add more.", r.Kind, r.Current, r.Max, r.PlanName))
			return
		}
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
	id := chi.URLParam(req, "id")
	// Guard: a user cannot delete their own account (would orphan the session).
	if id == middleware.GetUserID(req) {
		apphttp.ValidationError(w, "cannot delete your own account")
		return
	}
	if err := m.svc.DeleteUser(req.Context(), id, middleware.GetTenantID(req)); err != nil {
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

// POST /{id}/reset-password — owner generates a one-time temp password for a staff
// user. Tenant-scoped (RequireResource("users") on the mount) + users:edit. Returns
// the plain temp once so the owner can hand it to the staff out-of-band. Bumps
// sessionVersion so the staff's current session is invalidated.
func (m *Module) resetUserPassword(w http.ResponseWriter, req *http.Request) {
	temp, err := m.svc.ResetUserPassword(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]string{"tempPassword": temp})
}

// ====================
// Roles
// ====================

func (m *Module) listRoles(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	f := application.ListFilter{Search: req.URL.Query().Get("search")}
	// Intentionally unpaginated (matches the original TS contract).
	f.All = true

	// TS /api/roles returns the curated DTO list unpaginated (no meta).
	list, _, err := m.svc.ListRoleItems(req.Context(), tenantID, f)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
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
