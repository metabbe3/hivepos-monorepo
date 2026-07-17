package billing

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/billing/application"
	"github.com/hivepos/api/internal/modules/billing/domain"
	"github.com/hivepos/api/internal/modules/billing/infrastructure"
	"github.com/hivepos/api/internal/planlimits"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the billing domain: repository → service → HTTP handlers.
type Module struct {
	svc *application.Service
	db  *sql.DB
}

// NewModule constructs the billing module from a *sql.DB + Midtrans config.
func NewModule(db interface{}, midtransServerKey, midtransEnv string) *Module {
	pg := db.(*sql.DB)
	repo := infrastructure.NewPgBillingRepository(pg)
	return &Module{svc: application.NewService(repo, midtransServerKey, midtransEnv), db: pg}
}

// Register mounts the billing sub-router.
func (m *Module) Register(r chi.Router) {
	r.Get("/status", m.status)
	r.Post("/checkout", m.checkout)
	r.Post("/webhook", m.webhook)
	r.Post("/promo/validate", m.validatePromo)
}

// GET /api/billing/status — mirrors TS /api/billing/status response shape.
func (m *Module) status(w http.ResponseWriter, req *http.Request) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}

	// Fetch subscription + tenant info via the service.
	sub, err := m.svc.GetStatus(req.Context(), tenantID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Real per-outlet prices from the Plan table (drives the billing page totals —
	// never hardcoded). Default to sane fallbacks if a tier row is missing.
	growthPrice := 49000.0
	proPrice := 79000.0
	if p, err := m.svc.Repo.GetPlanByTier(req.Context(), "GROWTH"); err == nil && p != nil && p.Price > 0 {
		growthPrice = p.Price
	}
	if p, err := m.svc.Repo.GetPlanByTier(req.Context(), "PRO"); err == nil && p != nil && p.Price > 0 {
		proPrice = p.Price
	}

	// Build the TS-matching BillingStatus shape.
	status := &domain.BillingStatus{
		ExpiringSoon: []interface{}{},
		Payments:     []interface{}{},
		Pricing:      domain.BillingPricing{OriginalUnitPrice: growthPrice, UnitPrice: growthPrice},
		GrowthPrice:  growthPrice,
		ProPrice:     proPrice,
		Subscription: domain.BillingSub{
			Status:   string(sub.Status),
			PlanName: sub.PlanName,
		},
	}

	// Plan-driven limits (super-admin Plan row) + current usage.
	if lim, err := planlimits.Resolve(req.Context(), m.db, tenantID); err == nil && lim != nil {
		status.Limits = domain.BillingLimits{
			IsPaid:     lim.IsPaid,
			MaxOutlets: lim.MaxOutlets,
			MaxUsers:   lim.MaxUsers,
			MaxOrders:  lim.MaxOrders,
			PlanName:   lim.PlanName,
		}
		// Prefer the resolved plan name (covers tenants whose subscription row lacks it).
		if status.Subscription.PlanName == "" {
			status.Subscription.PlanName = lim.PlanName
		}
	} else {
		status.Limits = domain.BillingLimits{PlanName: "Free", MaxOutlets: 1, MaxUsers: 2, MaxOrders: 100}
	}
	if u, err := planlimits.UsageCounts(req.Context(), m.db, tenantID); err == nil {
		status.OutletsUsed = u.OutletsUsed
		status.UsersUsed = u.UsersUsed
		status.OrdersUsedMonth = u.OrdersUsedMonth
	}
	if sub.CurrentPeriodEnd != nil && !sub.CurrentPeriodEnd.IsZero() {
		s := sub.CurrentPeriodEnd.UTC().Format("2006-01-02T15:04:05.000Z")
		status.Subscription.CurrentPeriodEnd = &s
	}
	if sub.TrialEnd != nil && !sub.TrialEnd.IsZero() {
		s := sub.TrialEnd.UTC().Format("2006-01-02T15:04:05.000Z")
		status.TrialEndsAt = &s
	}

	// Fetch outlets + tenant info.
	outlets, _ := m.svc.Repo.GetOutlets(req.Context(), tenantID)
	if outlets != nil {
		status.Outlets = outlets
	}
	tenantInfo, _ := m.svc.Repo.GetTenantInfo(req.Context(), tenantID)
	if tenantInfo != nil {
		status.Tenant = *tenantInfo
	}

	apphttp.Success(w, status)
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
	if input.PlanTier == "" && input.PlanID == "" {
		apphttp.ValidationError(w, "planTier is required")
		return
	}

	result, err := m.svc.Checkout(req.Context(), input, tenantID)
	if err != nil {
		// Validation/business-rule rejections → 400 with the real message.
		apphttp.ValidationError(w, err.Error())
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
