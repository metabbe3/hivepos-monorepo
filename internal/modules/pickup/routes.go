package pickup

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/pickup/application"
	"github.com/hivepos/api/internal/modules/pickup/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the pickup domain: repository -> service -> HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgPickupRepository(db)
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the pickup sub-router.
// Note: count-pending is registered before {id} so chi doesn't treat "count-pending"
// as an {id} path param.
func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Get("/count-pending", m.countPending)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getByID)
		r.Post("/accept", m.accept)
		r.Post("/reject", m.reject)
		r.Post("/schedule", m.schedule)
		r.Post("/assign", m.assign)
		r.Post("/convert", m.convert)
	})
}

func (m *Module) list(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	f := application.ListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		Status:   req.URL.Query().Get("status"),
		Search:   req.URL.Query().Get("search"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		f.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		f.Limit = l
	}

	list, total, err := m.svc.List(req.Context(), tenantID, f)
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

func (m *Module) create(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	var input application.CreateInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.BranchID == "" {
		input.BranchID = middleware.GetBranchID(req)
	}

	p, err := m.svc.Create(req.Context(), input, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, p)
}

func (m *Module) getByID(w http.ResponseWriter, req *http.Request) {
	p, err := m.svc.Get(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Pickup request not found")
		return
	}
	apphttp.Success(w, p)
}

func (m *Module) accept(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.Accept(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true, "status": "ACCEPTED"})
}

func (m *Module) reject(w http.ResponseWriter, req *http.Request) {
	var inp application.TransitionInput
	_ = json.NewDecoder(req.Body).Decode(&inp) // optional body
	if err := m.svc.Reject(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req), inp); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true, "status": "REJECTED"})
}

func (m *Module) schedule(w http.ResponseWriter, req *http.Request) {
	var inp application.TransitionInput
	if err := json.NewDecoder(req.Body).Decode(&inp); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if err := m.svc.Schedule(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req), inp); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true, "status": "SCHEDULED"})
}

func (m *Module) assign(w http.ResponseWriter, req *http.Request) {
	var inp application.TransitionInput
	if err := json.NewDecoder(req.Body).Decode(&inp); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if err := m.svc.Assign(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req), inp); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true, "status": "ASSIGNED"})
}

func (m *Module) convert(w http.ResponseWriter, req *http.Request) {
	var inp application.TransitionInput
	if err := json.NewDecoder(req.Body).Decode(&inp); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if err := m.svc.Convert(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req), inp); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true, "status": "CONVERTED"})
}

func (m *Module) countPending(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	count, err := m.svc.CountPending(req.Context(), tenantID, req.URL.Query().Get("branchId"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"count": count})
}
