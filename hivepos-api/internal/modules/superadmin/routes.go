package superadmin

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/auth"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/superadmin/application"
	"github.com/hivepos/api/internal/modules/superadmin/domain"
	"github.com/hivepos/api/internal/modules/superadmin/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
	"github.com/hivepos/api/internal/shared/pagination"
)

type Module struct {
	svc     *application.Service
	repo    *infrastructure.PgSuperAdminRepository
	db      *sql.DB
	aiKey   string
	aiModel string
	aiBase  string
}

func NewModule(db *sql.DB, aiKey, aiModel, aiBase string) *Module {
	repo := infrastructure.NewPgSuperAdminRepository(db)
	return &Module{svc: application.NewService(repo), repo: repo, db: db, aiKey: aiKey, aiModel: aiModel, aiBase: aiBase}
}

// Register mounts all super-admin endpoints. Every route is cross-tenant (platform-level).
// Upstream middleware must gate on SUPER_ADMIN role.
func (m *Module) Register(r chi.Router) {
	// Stats + billing overview
	r.Get("/stats", m.getStats)
	r.Get("/billing/overview", m.getBillingOverview)
	// Cross-tenant performance (revenue/order volume/trial health).
	r.Get("/performance", m.performance)
	// Pickup-request rejection insights.
	r.Get("/pickup-insights", m.pickupInsights)

	// Tenants
	r.Get("/tenants", m.listTenants)
	r.Route("/tenants/{id}", func(r chi.Router) {
		r.Get("/", m.getTenant)
		r.Patch("/", m.updateTenant)
		r.Get("/billing", m.getTenantBilling)
		r.Post("/approve", m.approveTenant)
		r.Post("/suspend", m.suspendTenant)
		r.Delete("/suspend", m.reactivateTenant)
		r.Patch("/subscription", m.updateTenantSubscription)
		r.Patch("/whatsapp", m.toggleWhatsApp)
	})

	// Users
	r.Get("/users", m.listUsers)
	// Platform-staff accounts (list-only migration for the admins page).
	r.Get("/admins", m.listAdmins)
	r.Post("/admins", m.createAdmin)
	r.Route("/admins/{id}", func(r chi.Router) {
		r.Patch("/", m.updateAdmin)
		r.Delete("/", m.deleteAdmin)
	})
	r.Route("/users/{id}", func(r chi.Router) {
		r.Post("/reset-password", m.resetUserPassword)
		r.Post("/suspend", m.suspendUser)
		r.Delete("/suspend", m.reactivateUser)
	})

	// Billing / payments
	r.Get("/billing/payments", m.listPayments)
	r.Post("/billing/payments/{id}/refund", m.refundPayment)

	// Plans
	r.Get("/plans", m.listPlans)
	r.Post("/plans", m.createPlan)
	r.Route("/plans/{id}", func(r chi.Router) {
		r.Patch("/", m.updatePlan)
		r.Delete("/", m.deletePlan)
	})

	// Promo codes
	r.Get("/promo-codes", m.listPromoCodes)
	r.Post("/promo-codes", m.createPromoCode)
	r.Route("/promo-codes/{id}", func(r chi.Router) {
		r.Patch("/", m.updatePromoCode)
		r.Delete("/", m.deletePromoCode)
	})

	// Feature flags + tenant overrides
	r.Get("/feature-flags", m.listFeatureFlags)
	r.Post("/feature-flags", m.createFeatureFlag)
	r.Route("/feature-flags/{id}", func(r chi.Router) {
		r.Get("/", m.getFeatureFlag)
		r.Patch("/", m.updateFeatureFlag)
		r.Delete("/", m.deleteFeatureFlag)
		r.Get("/tenants", m.listTenantFlags)
		r.Post("/tenants", m.upsertTenantFlag)
		r.Delete("/tenants/{tenantId}", m.deleteTenantFlag)
	})

	// Referrals
	r.Get("/referrals", m.listReferrals)
	r.Patch("/referrals/{id}", m.updateReferral)

	// Tickets
	r.Get("/tickets", m.listTickets)
	r.Route("/tickets/{id}", func(r chi.Router) {
		r.Get("/", m.getTicket)
		r.Post("/comments", m.addTicketComment)
		r.Post("/status", m.updateTicketStatus)
		r.Post("/priority", m.updateTicketPriority)
	})

	// Error logs
	r.Get("/error-logs", m.listErrorLogs)
	r.Post("/error-logs/{id}/resolve", m.resolveErrorLog)
	r.Delete("/error-logs/{id}/resolve", m.resolveErrorLog)

	// Blog
	r.Get("/blog", m.listBlogPosts)
	r.Post("/blog", m.createBlogPost)
	r.Route("/blog/{id}", func(r chi.Router) {
		r.Get("/", m.getBlogPost)
		r.Patch("/", m.updateBlogPost)
		r.Delete("/", m.deleteBlogPost)
	})

	// Audit log
	r.Get("/audit-log", m.listAuditLogs)

	// Impersonation
	r.Post("/impersonate", m.startImpersonation)
	r.Post("/impersonate/stop", m.stopImpersonation)

	// Self
	r.Post("/me/password", m.updatePassword)
	r.Post("/me/sessions", m.revokeSessions)

	// PWA force update
	r.Post("/pwa/force-update", m.forceUpdate)

	// Impersonation stop
	r.Post("/impersonate/stop", m.stopImpersonation)

	// AI chat (stub)
	r.Get("/ai/chat", m.aiChatConfig)
	r.Post("/ai/chat", m.aiChat)
}

// ===================== STATS =====================

func (m *Module) getStats(w http.ResponseWriter, req *http.Request) {
	s, err := m.svc.GetStats(req.Context())
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, s)
}

// performance — cross-tenant performance rows for /super-admin/performance.
func (m *Module) performance(w http.ResponseWriter, req *http.Request) {
	list, err := m.repo.GetTenantPerformance(req.Context(), req.URL.Query().Get("sort"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if list == nil {
		list = []map[string]any{}
	}
	apphttp.Success(w, list)
}

func (m *Module) getBillingOverview(w http.ResponseWriter, req *http.Request) {
	o, err := m.svc.GetBillingOverview(req.Context())
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, o)
}

// ===================== TENANTS =====================

func (m *Module) listTenants(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListTenants(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, pagination.Meta(int(total), filter.Page, filter.Limit))
}

func (m *Module) getTenant(w http.ResponseWriter, req *http.Request) {
	ctx := req.Context()
	id := chi.URLParam(req, "id")
	t, err := m.svc.GetTenant(ctx, id)
	if err != nil {
		apphttp.NotFoundError(w, err.Error())
		return
	}
	// Composite: the super-admin tenant page reads d.plans (plan selector) +
	// d.subscription / d.planName / d.subscriptionStatus. The bare tenant returned
	// none of these, so the plan-change UI rendered an empty plan list.
	plans, _ := m.svc.ListPlans(ctx)
	sub, _ := m.svc.GetTenantSubscription(ctx, id)
	planName, subStatus := "", ""
	if sub != nil {
		subStatus = sub.Status
		for _, p := range plans {
			if p.ID == sub.PlanID {
				planName = p.Name
				break
			}
		}
	}
	apphttp.Success(w, map[string]any{
		"tenant":             t,
		"plans":              plans,
		"subscription":       sub,
		"planName":           planName,
		"subscriptionStatus": subStatus,
	})
}

func (m *Module) updateTenant(w http.ResponseWriter, req *http.Request) {
	var input application.TenantInput
	if !decodeJSON(w, req, &input) {
		return
	}
	t, err := m.svc.UpdateTenant(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func (m *Module) approveTenant(w http.ResponseWriter, req *http.Request) {
	t, err := m.svc.ApproveTenant(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func (m *Module) suspendTenant(w http.ResponseWriter, req *http.Request) {
	t, err := m.svc.SuspendTenant(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func (m *Module) reactivateTenant(w http.ResponseWriter, req *http.Request) {
	t, err := m.svc.ReactivateTenant(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func (m *Module) getTenantBilling(w http.ResponseWriter, req *http.Request) {
	billing, err := m.svc.GetTenantBilling(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, billing)
}

func (m *Module) updateTenantSubscription(w http.ResponseWriter, req *http.Request) {
	var input application.SubscriptionInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Op == "extend_trial" {
		if input.Days < 1 || input.Days > 365 {
			apphttp.ValidationError(w, "days must be between 1 and 365")
			return
		}
		if len(input.Reason) < 10 {
			apphttp.ValidationError(w, "reason must be at least 10 characters")
			return
		}
	}
	sub, err := m.svc.UpdateTenantSubscription(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, sub)
}

// PATCH /tenants/{id}/whatsapp — toggle settings.whatsappEnabled for this tenant.
// Body: { "enabled": true/false }
func (m *Module) toggleWhatsApp(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Enabled bool `json:"enabled"`
	}
	if !decodeJSON(w, req, &body) {
		return
	}
	tenantID := chi.URLParam(req, "id")
	if err := m.repo.ToggleTenantWhatsApp(req.Context(), tenantID, body.Enabled); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{"ok": true, "whatsappEnabled": body.Enabled})
}

// ===================== USERS =====================

func (m *Module) listUsers(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListUsers(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, pagination.Meta(int(total), filter.Page, filter.Limit))
}

// listAdmins — platform-staff accounts for the /super-admin/admins page.
func (m *Module) listAdmins(w http.ResponseWriter, req *http.Request) {
	list, err := m.repo.ListAdmins(req.Context())
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if list == nil {
		list = []map[string]any{}
	}
	apphttp.Success(w, list)
}

// createAdmin — POST /admins {email, name, password, role}
func (m *Module) createAdmin(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Name     string `json:"name"`
		Password string `json:"password"`
		Role     string `json:"role"`
	}
	if !decodeJSON(w, req, &body) {
		return
	}
	if body.Email == "" || body.Name == "" || len(body.Password) < 8 {
		apphttp.ValidationError(w, "email, name, and an 8+ char password are required")
		return
	}
	if body.Role == "" {
		body.Role = "SUPER_ADMIN"
	}
	hash, err := auth.HashPassword(body.Password)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "failed to hash password")
		return
	}
	a, err := m.repo.CreateAdmin(req.Context(), body.Email, body.Name, hash, body.Role)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, a)
}

// updateAdmin — PATCH /admins/{id} {role}
func (m *Module) updateAdmin(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Role string `json:"role"`
	}
	if !decodeJSON(w, req, &body) {
		return
	}
	if err := m.repo.UpdateAdminRole(req.Context(), chi.URLParam(req, "id"), body.Role); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{"ok": true})
}

// deleteAdmin — DELETE /admins/{id}
func (m *Module) deleteAdmin(w http.ResponseWriter, req *http.Request) {
	if err := m.repo.DeleteAdmin(req.Context(), chi.URLParam(req, "id")); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{"ok": true})
}

func (m *Module) suspendUser(w http.ResponseWriter, req *http.Request) {
	u, err := m.svc.SuspendUser(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, u)
}

func (m *Module) reactivateUser(w http.ResponseWriter, req *http.Request) {
	u, err := m.svc.ReactivateUser(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, u)
}

func (m *Module) resetUserPassword(w http.ResponseWriter, req *http.Request) {
	temp, err := m.svc.ResetUserPassword(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]string{"tempPassword": temp})
}

// getTicket — GET /tickets/{id}: ticket + its comment thread.
func (m *Module) getTicket(w http.ResponseWriter, req *http.Request) {
	id := chi.URLParam(req, "id")
	t, err := m.svc.GetTicket(req.Context(), id)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if t == nil {
		apphttp.NotFoundError(w, "ticket not found")
		return
	}
	comments, _ := m.repo.ListTicketComments(req.Context(), id)
	raw, _ := json.Marshal(t)
	var tm map[string]any
	_ = json.Unmarshal(raw, &tm)
	if comments == nil {
		comments = []*domain.TicketComment{}
	}
	tm["comments"] = comments
	apphttp.Success(w, tm)
}

// ===================== PAYMENTS =====================

func (m *Module) listPayments(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListPayments(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeRows(w, list, total, filter)
}

func (m *Module) refundPayment(w http.ResponseWriter, req *http.Request) {
	p, err := m.svc.RefundPayment(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, p)
}

// ===================== PLANS =====================

func (m *Module) listPlans(w http.ResponseWriter, req *http.Request) {
	list, err := m.svc.ListPlans(req.Context())
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}

func (m *Module) createPlan(w http.ResponseWriter, req *http.Request) {
	var input application.PlanInput
	if !decodeJSON(w, req, &input) {
		return
	}
	p, err := m.svc.CreatePlan(req.Context(), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, p)
}

func (m *Module) updatePlan(w http.ResponseWriter, req *http.Request) {
	var input application.PlanInput
	if !decodeJSON(w, req, &input) {
		return
	}
	p, err := m.svc.UpdatePlan(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, p)
}

func (m *Module) deletePlan(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeletePlan(req.Context(), chi.URLParam(req, "id")); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

// ===================== PROMO CODES =====================

func (m *Module) listPromoCodes(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListPromoCodes(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, pagination.Meta(int(total), filter.Page, filter.Limit))
}

func (m *Module) createPromoCode(w http.ResponseWriter, req *http.Request) {
	var input application.PromoCodeInput
	if !decodeJSON(w, req, &input) {
		return
	}
	p, err := m.svc.CreatePromoCode(req.Context(), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, p)
}

func (m *Module) updatePromoCode(w http.ResponseWriter, req *http.Request) {
	var input application.PromoCodeInput
	if !decodeJSON(w, req, &input) {
		return
	}
	p, err := m.svc.UpdatePromoCode(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, p)
}

func (m *Module) deletePromoCode(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeletePromoCode(req.Context(), chi.URLParam(req, "id")); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

// ===================== FEATURE FLAGS =====================

func (m *Module) listFeatureFlags(w http.ResponseWriter, req *http.Request) {
	list, err := m.svc.ListFeatureFlags(req.Context())
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list)
}

// getFeatureFlag — GET /feature-flags/{id}.
func (m *Module) getFeatureFlag(w http.ResponseWriter, req *http.Request) {
	f, err := m.repo.GetFeatureFlag(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if f == nil {
		apphttp.NotFoundError(w, "flag not found")
		return
	}
	apphttp.Success(w, f)
}

func (m *Module) createFeatureFlag(w http.ResponseWriter, req *http.Request) {
	var input application.FeatureFlagInput
	if !decodeJSON(w, req, &input) {
		return
	}
	f, err := m.svc.CreateFeatureFlag(req.Context(), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, f)
}

func (m *Module) updateFeatureFlag(w http.ResponseWriter, req *http.Request) {
	var input application.FeatureFlagInput
	if !decodeJSON(w, req, &input) {
		return
	}
	f, err := m.svc.UpdateFeatureFlag(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, f)
}

func (m *Module) deleteFeatureFlag(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteFeatureFlag(req.Context(), chi.URLParam(req, "id")); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func (m *Module) listTenantFlags(w http.ResponseWriter, req *http.Request) {
	flagID := chi.URLParam(req, "id")
	q := req.URL.Query().Get("q")
	overrideOnly := req.URL.Query().Get("overrideOnly") == "true"
	list, err := m.repo.ListAllTenantFlags(req.Context(), flagID, q, overrideOnly)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	if list == nil {
		list = []map[string]any{}
	}
	apphttp.Success(w, list)
}

func (m *Module) upsertTenantFlag(w http.ResponseWriter, req *http.Request) {
	var input application.TenantFlagInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.TenantID == "" {
		apphttp.ValidationError(w, "tenantId is required")
		return
	}
	tf, err := m.svc.UpsertTenantFlag(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, tf)
}

func (m *Module) deleteTenantFlag(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteTenantFlag(req.Context(), chi.URLParam(req, "id"), chi.URLParam(req, "tenantId")); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

// ===================== REFERRALS =====================

func (m *Module) listReferrals(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListReferrals(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, pagination.Meta(int(total), filter.Page, filter.Limit))
}

func (m *Module) updateReferral(w http.ResponseWriter, req *http.Request) {
	var body struct {
		Status string `json:"status"`
		Reason string `json:"reason"`
	}
	if !decodeJSON(w, req, &body) {
		return
	}
	if body.Status == "" {
		apphttp.ValidationError(w, "status is required")
		return
	}
	ref, err := m.svc.UpdateReferral(req.Context(), chi.URLParam(req, "id"), body.Status, body.Reason)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, ref)
}

// ===================== TICKETS =====================

func (m *Module) listTickets(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListTickets(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeRows(w, list, total, filter)
}

func (m *Module) addTicketComment(w http.ResponseWriter, req *http.Request) {
	var input application.CommentInput
	if !decodeJSON(w, req, &input) {
		return
	}
	actorID := middleware.GetUserID(req)
	c, err := m.svc.AddTicketComment(req.Context(), chi.URLParam(req, "id"), input.Body, actorID, "")
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, c)
}

func (m *Module) updateTicketStatus(w http.ResponseWriter, req *http.Request) {
	var input application.TicketStatusInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Status == "" {
		apphttp.ValidationError(w, "status is required")
		return
	}
	t, err := m.svc.UpdateTicketStatus(req.Context(), chi.URLParam(req, "id"), input.Status)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func (m *Module) updateTicketPriority(w http.ResponseWriter, req *http.Request) {
	var input application.TicketPriorityInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.Priority == "" {
		apphttp.ValidationError(w, "priority is required")
		return
	}
	t, err := m.svc.UpdateTicketPriority(req.Context(), chi.URLParam(req, "id"), input.Priority)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

// ===================== ERROR LOGS =====================

func (m *Module) listErrorLogs(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListErrorLogs(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeRows(w, list, total, filter)
}

func (m *Module) resolveErrorLog(w http.ResponseWriter, req *http.Request) {
	// POST → resolved=true, DELETE → resolved=false (toggle). Return an envelope
	// (not 204) so the client apiFetch (which throws on empty bodies) is happy.
	resolved := req.Method != http.MethodDelete
	if err := m.repo.ResolveErrorLog(req.Context(), chi.URLParam(req, "id"), resolved); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]any{"ok": true, "resolved": resolved})
}

// ===================== BLOG =====================

func (m *Module) listBlogPosts(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListBlogPosts(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, pagination.Meta(int(total), filter.Page, filter.Limit))
}

func (m *Module) createBlogPost(w http.ResponseWriter, req *http.Request) {
	var input application.BlogPostInput
	if !decodeJSON(w, req, &input) {
		return
	}
	authorID := middleware.GetUserID(req)
	b, err := m.svc.CreateBlogPost(req.Context(), input, authorID)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Created(w, b)
}

func (m *Module) getBlogPost(w http.ResponseWriter, req *http.Request) {
	b, err := m.svc.GetBlogPost(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.NotFoundError(w, err.Error())
		return
	}
	apphttp.Success(w, b)
}

func (m *Module) updateBlogPost(w http.ResponseWriter, req *http.Request) {
	var input application.BlogPostInput
	if !decodeJSON(w, req, &input) {
		return
	}
	b, err := m.svc.UpdateBlogPost(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, b)
}

func (m *Module) deleteBlogPost(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteBlogPost(req.Context(), chi.URLParam(req, "id")); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

// ===================== AUDIT LOG =====================

func (m *Module) listAuditLogs(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListAuditLogs(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, pagination.Meta(int(total), filter.Page, filter.Limit))
}

// ===================== IMPERSONATION =====================

func (m *Module) startImpersonation(w http.ResponseWriter, req *http.Request) {
	var input application.ImpersonateInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.TenantID == "" && input.UserID == "" {
		apphttp.ValidationError(w, "tenantId or userId is required")
		return
	}
	actorID := middleware.GetUserID(req)
	token, err := m.repo.CreateImpersonation(req.Context(), application.ImpersonInput{
		TenantID: input.TenantID, UserID: input.UserID, ActorID: actorID,
	})
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, map[string]string{"token": token})
}

// ===================== SELF =====================

func (m *Module) updatePassword(w http.ResponseWriter, req *http.Request) {
	var input application.PasswordInput
	if !decodeJSON(w, req, &input) {
		return
	}
	if input.NewPassword == "" {
		apphttp.ValidationError(w, "newPassword is required")
		return
	}
	actorID := middleware.GetUserID(req)
	if err := m.svc.UpdatePassword(req.Context(), actorID, input.CurrentPassword, input.NewPassword); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func (m *Module) revokeSessions(w http.ResponseWriter, req *http.Request) {
	actorID := middleware.GetUserID(req)
	if err := m.svc.RevokeSessions(req.Context(), actorID); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

// ===================== PWA + AI =====================

func (m *Module) forceUpdate(w http.ResponseWriter, req *http.Request) {
	// Bump the PWA nonce in SystemSetting → clients polling /api/pwa/nonce see the new value,
	// mismatch against localStorage → nuke caches + reload. Propagates within the 3min poll window.
	if _, err := m.db.ExecContext(req.Context(), `
		INSERT INTO "SystemSetting" (id, key, value, "updatedAt")
		VALUES (gen_random_uuid()::text, 'pwaNonce', gen_random_uuid()::text, NOW())
		ON CONFLICT (key) DO UPDATE SET value = gen_random_uuid()::text, "updatedAt" = NOW()
	`); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, "bumping PWA nonce: "+err.Error())
		return
	}
	apphttp.Success(w, map[string]string{"status": "force-updated"})
}

// stopImpersonation — logs the stop action (audit trail). Stateless JWTs have no server-side
// session to revoke; the frontend drops the impersonation token from localStorage.
func (m *Module) stopImpersonation(w http.ResponseWriter, req *http.Request) {
	if _, err := m.db.ExecContext(req.Context(),
		`INSERT INTO "AuditLog" (id, action, "targetType", reason, "createdAt")
		 VALUES (gen_random_uuid()::text, 'IMPERSONATION_STOP', 'user', 'Super-admin stopped impersonation', NOW())`); err != nil {
		// Best-effort — don't fail the stop on audit-log error.
	}
	apphttp.Success(w, map[string]bool{"stopped": true})
}

// aiChatConfig — GET /ai/chat. Enabled when an AI key is configured.
func (m *Module) aiChatConfig(w http.ResponseWriter, req *http.Request) {
	apphttp.Success(w, map[string]interface{}{"enabled": m.aiKey != "", "model": m.aiModel})
}

// aiChat — POST /ai/chat {question, history}. Streams the FE's SSE protocol
// (data: {"type":"delta",content} … data: [DONE]). Calls an OpenAI-compatible
// chat completion when a key is set; otherwise emits a disabled notice.
func (m *Module) aiChat(w http.ResponseWriter, req *http.Request) {
	flusher, _ := w.(http.Flusher)
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	sse := func(evt map[string]interface{}) {
		b, _ := json.Marshal(evt)
		_, _ = w.Write([]byte("data: " + string(b) + "\n\n"))
		if flusher != nil {
			flusher.Flush()
		}
	}

	var body struct {
		Question string `json:"question"`
		History  []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"history"`
	}
	_ = json.NewDecoder(req.Body).Decode(&body)

	reply := "AI assistant is not configured (set AI_API_KEY on the server)."
	if m.aiKey != "" && body.Question != "" {
		msgs := []map[string]string{{"role": "system", "content": "You are hivePOS's super-admin assistant. Answer concisely about platform admin tasks (tenants, billing, plans)."}}
		for _, h := range body.History {
			if h.Role == "user" || h.Role == "assistant" {
				msgs = append(msgs, map[string]string{"role": h.Role, "content": h.Content})
			}
		}
		msgs = append(msgs, map[string]string{"role": "user", "content": body.Question})
		if r, err := m.completeChat(req.Context(), msgs); err == nil {
			reply = r
		} else {
			reply = "AI request failed: " + err.Error()
		}
	}

	// Emit as one delta (non-streaming upstream) + close.
	sse(map[string]interface{}{"type": "delta", "content": reply})
	_, _ = w.Write([]byte("data: [DONE]\n\n"))
	if flusher != nil {
		flusher.Flush()
	}
}

// completeChat calls an OpenAI-compatible /chat/completions endpoint (non-stream).
func (m *Module) completeChat(ctx context.Context, messages []map[string]string) (string, error) {
	payload, _ := json.Marshal(map[string]interface{}{
		"model":    m.aiModel,
		"messages": messages,
	})
	hr, err := http.NewRequestWithContext(ctx, http.MethodPost, m.aiBase+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	hr.Header.Set("Content-Type", "application/json")
	hr.Header.Set("Authorization", "Bearer "+m.aiKey)
	// TODO(self-heal): wrap in resilience.CircuitBreaker. Needs status-aware
	// classification first (count transport + 5xx, not 4xx — a 4xx here is auth/
	// config, not AI-provider health). See internal/shared/resilience.
	resp, err := http.DefaultClient.Do(hr)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("ai %d: %s", resp.StatusCode, string(raw))
	}
	var out struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.Unmarshal(raw, &out); err != nil || len(out.Choices) == 0 {
		return "", fmt.Errorf("ai decode: %s", string(raw))
	}
	return out.Choices[0].Message.Content, nil
}

// ===================== helpers =====================

func parseListFilter(req *http.Request) application.ListFilter {
	f := application.ListFilter{
		Search: req.URL.Query().Get("search"),
		Status: req.URL.Query().Get("status"),
		Sort:   req.URL.Query().Get("sort"),
		Order:  req.URL.Query().Get("order"),
	}
	if p, err := strconv.Atoi(req.URL.Query().Get("page")); err == nil {
		f.Page = p
	}
	if l, err := strconv.Atoi(req.URL.Query().Get("limit")); err == nil {
		f.Limit = l
	}
	f.Page, f.Limit, _ = pagination.Normalize(f.Page, f.Limit)
	return f
}

// writeRows emits the paginated shape the super-admin panel expects:
// { rows: [...], page, hasNext }. (The web reads data.rows / data.hasNext.)
func writeRows(w http.ResponseWriter, list any, total int64, filter application.ListFilter) {
	apphttp.Success(w, map[string]any{
		"rows":    list,
		"page":    filter.Page,
		"hasNext": filter.Page*filter.Limit < int(total),
	})
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(req.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}

// GET /pickup-insights?from=&to= — cross-tenant pickup-request rejection analytics.
func (m *Module) pickupInsights(w http.ResponseWriter, req *http.Request) {
	insights, err := m.svc.GetPickupInsights(req.Context(), req.URL.Query().Get("from"), req.URL.Query().Get("to"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, insights)
}
