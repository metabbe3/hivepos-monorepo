package orders

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/orders/application"
	"github.com/hivepos/api/internal/modules/orders/domain"
	"github.com/hivepos/api/internal/modules/orders/infrastructure"
	"github.com/hivepos/api/internal/planlimits"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"github.com/hivepos/api/internal/shared/pagination"
)

// Module wires the orders domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
	db  *sql.DB
}

func NewModule(db interface{}) *Module {
	// Cast to *sql.DB — passed from main.go
	pg := db.(*sql.DB)
	repo := infrastructure.NewPgOrderRepository(pg)
	return &Module{svc: application.NewService(repo), db: pg}
}

// Register mounts the orders sub-router.
func (m *Module) Register(r chi.Router) {
	r.Get("/", m.list)
	r.Post("/", m.create)
	r.Route("/{id}", func(r chi.Router) {
		r.Get("/", m.getByID)
		r.Patch("/", m.updateNotes)
		r.Put("/", m.update)
		r.Delete("/", m.delete)
		r.Post("/status", m.advanceStatus)
		r.Patch("/status", m.advanceStatus) // web's status dialog uses PATCH
		r.Post("/payments", m.recordPayment)
		r.Delete("/payments/{paymentId}", m.voidPayment)
	})
}

func (r *Module) list(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	filter := application.ListFilter{
		BranchID:      req.URL.Query().Get("branchId"),
		Status:        req.URL.Query().Get("status"),
		Search:        req.URL.Query().Get("search"),
		PaymentStatus: req.URL.Query().Get("paymentStatus"),
		DateFrom:      req.URL.Query().Get("dateFrom"),
		DateTo:        req.URL.Query().Get("dateTo"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		filter.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		filter.Limit = l
	}
	// Clamp in the handler so meta reflects the clamped values (TS: page≥1, limit 1..100, default 20).
	filter.Page, filter.Limit, _ = pagination.Normalize(filter.Page, filter.Limit)

	items, total, err := r.svc.ListItems(req.Context(), tenantID, filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	// TS orders meta = { total, page, totalPages } (no limit).
	apphttp.Success(w, items, pagination.MetaNoLimit(int(total), filter.Page, filter.Limit))
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

	if r.db != nil {
		if lr, _ := planlimits.Check(req.Context(), r.db, tenantID, planlimits.Orders); lr != nil && !lr.Allowed {
			apphttp.Error(w, http.StatusForbidden, fmt.Sprintf("%s limit reached (%d/%d) on the %s plan. Upgrade to create more orders.", lr.Kind, lr.Current, lr.Max, lr.PlanName))
			return
		}
	}

	// Idempotency via X-Client-Id header
	var clientID *string
	if cid := req.Header.Get("X-Client-Id"); cid != "" {
		clientID = &cid
	}

	order, err := r.svc.Create(req.Context(), input, tenantID, branchID, "", clientID)
	if err != nil {
		// Business-rule rejections (cross-tenant customer/service, pct discount range)
		// surface as 400 with the real message — not a redacted 500.
		apphttp.ValidationError(w, err.Error())
		return
	}

	// Best-effort WhatsApp auto-send: "Order received" receipt.
	// Fire-and-forget goroutine — never blocks the 201 response.
	go r.maybeSendWhatsAppReceipt(req.Context(), order, tenantID)

	apphttp.Created(w, order)
}

func (r *Module) getByID(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	order, err := r.svc.Repo.FindDetailByID(req.Context(), id, tenantID)
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

	// Persist notes (scoped to tenant via Branch join).
	res, err := r.db.ExecContext(req.Context(), `
		UPDATE "Order" SET notes = NULLIF($1, ''), "updatedAt" = NOW()
		WHERE id = $2 AND "branchId" IN (SELECT id FROM "Branch" WHERE "tenantId" = $3)`,
		body.Notes, id, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "updating notes: "+err.Error())
		return
	}
	if n, _ := res.RowsAffected(); n == 0 {
		apphttp.NotFoundError(w, "Order not found")
		return
	}
	apphttp.Success(w, map[string]interface{}{"ok": true})
}

func (r *Module) update(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var input application.UpdateOrderInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.CustomerID == "" || len(input.Items) == 0 {
		apphttp.ValidationError(w, "customerId and items are required")
		return
	}

	order, err := r.svc.Repo.Update(req.Context(), id, tenantID, input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, order)
}

func (r *Module) recordPayment(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")

	var body struct {
		Amount        float64 `json:"amount"`
		PaymentMethod string  `json:"paymentMethod"`
		Notes         string  `json:"notes"`
		PaidAt        string  `json:"paidAt"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if body.Amount <= 0 {
		apphttp.ValidationError(w, "amount must be positive")
		return
	}

	var paidAt *time.Time
	if body.PaidAt != "" {
		if t, err := time.Parse("2006-01-02", body.PaidAt); err == nil {
			paidAt = &t
		} else if t, err := time.Parse(time.RFC3339, body.PaidAt); err == nil {
			paidAt = &t
		}
	}

	order, err := r.svc.Repo.RecordPayment(req.Context(), id, tenantID, body.Amount, body.PaymentMethod, body.Notes, paidAt)
	if err != nil {
		// Business-rule rejections (overpayment, insufficient deposit) → 400 with message.
		apphttp.ValidationError(w, err.Error())
		return
	}
	apphttp.Success(w, order)
}

// DELETE /orders/{id}/payments/{paymentId} — void (reverse) a recorded payment.
func (r *Module) voidPayment(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	orderID := chi.URLParam(req, "id")
	paymentID := chi.URLParam(req, "paymentId")
	order, err := r.svc.Repo.VoidPayment(req.Context(), tenantID, orderID, paymentID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, order)
}

func (r *Module) delete(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	id := chi.URLParam(req, "id")
	if err := r.svc.Repo.Delete(req.Context(), id, tenantID); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
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
		// Illegal status transition → 400 with message.
		apphttp.ValidationError(w, err.Error())
		return
	}

	// Best-effort WhatsApp auto-send: "Order ready for pickup" when status → READY.
	if body.Status == "READY" {
		go r.maybeSendWhatsAppReady(id, tenantID)
	}

	apphttp.Success(w, map[string]interface{}{"ok": true, "status": body.Status})
}
