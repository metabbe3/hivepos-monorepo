package customers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/customers/application"
	"github.com/hivepos/api/internal/modules/customers/infrastructure"
	"github.com/hivepos/api/internal/shared/apperror"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgCustomerRepository(db)
	return &Module{svc: application.NewService(repo)}
}

func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getByID)
		r.Patch("/", m.update)
		r.Delete("/", m.delete)
		r.Get("/stats", m.stats)
		r.Get("/deposit", m.getDeposits)
		r.Post("/deposit", m.topUpDeposit)
	})
}

func (m *Module) list(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	filter := application.ListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		Search:   req.URL.Query().Get("search"),
		Status:   req.URL.Query().Get("status"),
		Sort:     req.URL.Query().Get("sort"),
		Order:    req.URL.Query().Get("order"),
	}
	// /api/customers is intentionally unpaginated (matches the original TS contract).
	filter.All = true

	list, _, err := m.svc.ListItems(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	// TS /api/customers returns the curated DTO list unpaginated (no meta).
	apphttp.Success(w, list)
}

func (m *Module) create(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	var input application.CreateCustomerInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Name == "" {
		apphttp.ValidationError(w, "name is required")
		return
	}

	var clientID *string
	if cid := req.Header.Get("X-Client-Id"); cid != "" {
		clientID = &cid
	}
	input.ClientID = clientID

	c, err := m.svc.Create(req.Context(), input, tenantID, branchID)
	if err != nil {
		if err.Error() == "customer with this phone already exists" {
			apphttp.Error(w, http.StatusConflict, err.Error())
			return
		}
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, c)
}

func (m *Module) getByID(w http.ResponseWriter, req *http.Request) {
	c, err := m.svc.Get(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Customer not found")
		return
	}
	apphttp.Success(w, c)
}

func (m *Module) update(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	c, err := m.svc.Get(req.Context(), id, middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Customer not found")
		return
	}
	if !decodeJSON(w, req, c) {
		return
	}
	c.ID = id
	if err := m.svc.Update(req.Context(), c); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, c)
}

func (m *Module) delete(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.Delete(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req)); err != nil {
		// Propagate business-rule errors (e.g. customer has orders) with their code/status
		// so the web can show the "blocked" state instead of a generic 500.
		apperror.Write(w, err)
		return
	}
	apphttp.NoContent(w)
}

func (m *Module) stats(w http.ResponseWriter, req *http.Request) {
	s, err := m.svc.GetStats(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, s)
}

func (m *Module) getDeposits(w http.ResponseWriter, req *http.Request) {
	list, err := m.svc.GetDeposits(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}

func (m *Module) topUpDeposit(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Amount       float64 `json:"amount"`
		Type         string  `json:"type"`
		Description  string  `json:"description"`
		Notes        string  `json:"notes"`
	}
	if !decodeJSON(w, req, &body) {
		return
	}
	if body.Amount <= 0 {
		apphttp.ValidationError(w, "amount must be positive")
		return
	}
	if body.Type == "" {
		body.Type = "TOP_UP"
	}
	// Web top-up dialog sends {amount, paymentMethod, description}; description is the note.
	note := body.Description
	if note == "" {
		note = body.Notes
	}

	d, err := m.svc.TopUpDeposit(req.Context(), chi.URLParam(req, "id"), middleware.GetTenantID(req), body.Amount, body.Type, note)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, d)
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(req.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
