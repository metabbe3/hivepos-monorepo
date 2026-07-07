package billing

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/billing/application"
	"github.com/hivepos/api/internal/modules/billing/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the billing domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
}

// NewModule constructs the billing module from a *sql.DB.
func NewModule(db interface{}) *Module {
	repo := infrastructure.NewPgBillingRepository(db.(*sql.DB))
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the billing sub-router.
func (m *Module) Register(r chi.Router) {
	r.Get("/status", m.status)
	r.Post("/checkout", m.checkout)
	r.Post("/webhook", m.webhook)
	r.Post("/promo/validate", m.validatePromo)
}

// GET /api/billing/status — current subscription + trial info for the tenant.
func (m *Module) status(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	sub, err := m.svc.GetStatus(req.Context(), tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Success(w, sub)
}

// POST /api/billing/checkout — create a (stubbed) Midtrans Snap token.
func (m *Module) checkout(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	var input application.CheckoutInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.PlanID == "" {
		apphttp.ValidationError(w, "planId is required")
		return
	}

	result, err := m.svc.Checkout(req.Context(), input, tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Created(w, result)
}

// POST /api/billing/webhook — Midtrans webhook handler (signature is stubbed).
func (m *Module) webhook(w http.ResponseWriter, req *http.Request) {
	var input application.WebhookInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.OrderID == "" || input.TransactionStatus == "" {
		apphttp.ValidationError(w, "order_id and transaction_status are required")
		return
	}

	if err := m.svc.HandleWebhook(req.Context(), input); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Success(w, map[string]interface{}{"ok": true})
}

// POST /api/billing/promo/validate — validate a promo code.
func (m *Module) validatePromo(w http.ResponseWriter, req *http.Request) {
	var input application.PromoValidateInput
	if err := json.NewDecoder(req.Body).Decode(&input); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if input.Code == "" {
		apphttp.ValidationError(w, "code is required")
		return
	}

	result, err := m.svc.ValidatePromo(req.Context(), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	apphttp.Success(w, result)
}
