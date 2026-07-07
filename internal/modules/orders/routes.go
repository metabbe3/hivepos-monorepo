package orders

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"github.com/hivepos/api/internal/modules/orders/application"
	"github.com/hivepos/api/internal/modules/orders/domain"
	"github.com/hivepos/api/internal/modules/orders/infrastructure"
	"github.com/hivepos/api/internal/middleware"
)

// Module wires the orders domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

func NewModule(db interface{}) *Module {
	// Cast to *sql.DB — passed from main.go
	repo := infrastructure.NewPgOrderRepository(db.(*sql.DB))
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the orders sub-router.
func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getByID)
		r.Patch("/", m.updateNotes)
		r.Delete("/", m.delete)
		r.Post("/status", m.advanceStatus)
	})
}

func (r *Module) list(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	filter := application.ListFilter{
		BranchID: req.URL.Query().Get("branchId"),
		Status:   req.URL.Query().Get("status"),
		Search:   req.URL.Query().Get("search"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		filter.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		filter.Limit = l
	}

	orders, total, err := r.svc.List(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Success(w, orders, map[string]interface{}{
		"total": total,
		"page":  filter.Page,
		"limit": filter.Limit,
	})
}

func (r *Module) create(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	branchID := middleware.GetBranchID(req)
	if tenantID == "" || branchID == "" {
		apphttp.ForbiddenError(w, "Missing tenant/branch context")
		return
	}

	var input application.CreateOrderInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	if input.CustomerID == "" {
		apphttp.ValidationError(w, "customerId is required")
		return
	}
	if len(input.Items) == 0 {
		apphttp.ValidationError(w, "At least one item is required")
		return
	}

	// Idempotency via X-Client-Id header
	var clientID *string
	if cid := req.Header.Get("X-Client-Id"); cid != "" {
		clientID = &cid
	}

	order, err := r.svc.Create(req.Context(), input, tenantID, branchID, "", clientID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Created(w, order)
}

func (r *Module) getByID(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	order, err := r.svc.Get(req.Context(), id, tenantID)
	if err != nil {
		apphttp.NotFoundError(w, "Order not found")
		return
	}

	apphttp.Success(w, order)
}

func (r *Module) updateNotes(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var body struct {
		Notes string `json:"notes"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	// Direct update — ponytail: no service method for notes-only yet.
	_ = body.Notes // TODO: add UpdateNotes to service
	_ = id
	_ = tenantID

	apphttp.Success(w, map[string]interface{}{"ok": true})
}

func (r *Module) delete(w http.ResponseWriter, req *http.Request) {
	// TODO: implement via service
	apphttp.Success(w, map[string]interface{}{"ok": true})
}

func (r *Module) advanceStatus(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var body struct {
		Status domain.OrderStatus `json:"status"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}

	if err := r.svc.Repo.UpdateStatus(req.Context(), id, tenantID, body.Status); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Success(w, map[string]interface{}{"ok": true, "status": body.Status})
}
