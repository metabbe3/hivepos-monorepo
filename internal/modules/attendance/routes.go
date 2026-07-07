package attendance

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/attendance/application"
	"github.com/hivepos/api/internal/modules/attendance/domain"
	"github.com/hivepos/api/internal/modules/attendance/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the attendance domain: repository -> service -> HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgAttendanceRepository(db)
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the attendance sub-router.
func (m *Module) Register(r chi.Router) {
	r.Get("/staff", m.listStaff)
	r.Get("/status", m.status)
	r.Post("/clock", m.clock)
	r.Get("/events", m.listEvents)
	r.Post("/events", m.createEvent)
	r.Post("/quick-staff", m.createQuickStaff)
	r.Route("/events/{id}", func(r chi.Router) {
		r.Patch("/", m.updateEvent)
		r.Delete("/", m.deleteEvent)
	})
}

func (m *Module) listStaff(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	list, err := m.svc.ListStaff(req.Context(), tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}

func (m *Module) status(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	list, err := m.svc.ListStatus(req.Context(), tenantID, req.URL.Query().Get("branchId"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}

// clock verifies the PIN against the stored hash, then toggles a clock event.
func (m *Module) clock(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	var body struct {
		UserID string `json:"userId"`
		PIN    string `json:"pin"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if body.UserID == "" || body.PIN == "" {
		apphttp.ValidationError(w, "userId and pin are required")
		return
	}

	// Load the staff member to get the stored PIN hash.
	staff, err := m.svc.Repo.FindStaffByPIN(req.Context(), tenantID, body.UserID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if staff == nil || staff.PinHash == nil {
		apphttp.NotFoundError(w, "Staff member not found or no PIN set")
		return
	}

	// Verify the PIN with bcrypt (same algorithm as password hashing).
	if err := application.VerifyPIN(body.PIN, *staff.PinHash); err != nil {
		apphttp.Error(w, http.StatusUnauthorized, "Invalid PIN")
		return
	}

	// PIN is valid — record the toggle.
	event, err := m.svc.Clock(req.Context(), tenantID, branchID, body.UserID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, event)
}

func (m *Module) listEvents(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	f := application.ListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		UserID:   req.URL.Query().Get("userId"),
		From:     req.URL.Query().Get("from"),
		To:       req.URL.Query().Get("to"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		f.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		f.Limit = l
	}

	list, total, err := m.svc.ListEvents(req.Context(), tenantID, f)
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

func (m *Module) createEvent(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)

	var input application.CreateEventInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.Type == "" {
		input.Type = domain.ClockIn
	}

	e, err := m.svc.CreateEvent(req.Context(), input, tenantID, branchID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, e)
}

func (m *Module) updateEvent(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var upd application.UpdateEventInput
	if err := json.NewDecoder(req.Body).Decode(&upd); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	if err := m.svc.UpdateEvent(req.Context(), id, tenantID, upd); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true})
}

func (m *Module) deleteEvent(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if err := m.svc.DeleteEvent(req.Context(), chi.URLParam(req, "id"), tenantID); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func (m *Module) createQuickStaff(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	var input application.QuickStaffInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.BranchID == "" {
		input.BranchID = middleware.GetBranchID(req)
	}

	staff, err := m.svc.CreateQuickStaff(req.Context(), input, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, staff)
}
