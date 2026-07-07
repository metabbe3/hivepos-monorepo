package superadmin

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/superadmin/application"
	"github.com/hivepos/api/internal/modules/superadmin/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

type Module struct {
	svc  *application.Service
	repo *infrastructure.PgSuperAdminRepository
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgSuperAdminRepository(db)
	return &Module{svc: application.NewService(repo), repo: repo}
}

// Register mounts all super-admin endpoints. Every route is cross-tenant (platform-level).
// Upstream middleware must gate on SUPER_ADMIN role.
func (m *Module) Register(r chi.Router) {
	// Stats + billing overview
	r.Get("/stats", m.getStats)
	r.Get("/billing/overview", m.getBillingOverview)

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
	})

	// Users
	r.Get("/users", m.listUsers)
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
		r.Post("/comments", m.addTicketComment)
		r.Post("/status", m.updateTicketStatus)
		r.Post("/priority", m.updateTicketPriority)
	})

	// Error logs
	r.Get("/error-logs", m.listErrorLogs)
	r.Post("/error-logs/{id}/resolve", m.resolveErrorLog)

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

	// AI chat (stub)
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
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
}

func (m *Module) getTenant(w http.ResponseWriter, req *http.Request) {
	t, err := m.svc.GetTenant(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.NotFoundError(w, err.Error())
		return
	}
	apphttp.Success(w, t)
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
	sub, err := m.svc.UpdateTenantSubscription(req.Context(), chi.URLParam(req, "id"), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, sub)
}

// ===================== USERS =====================

func (m *Module) listUsers(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListUsers(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
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

// ===================== PAYMENTS =====================

func (m *Module) listPayments(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListPayments(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
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
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
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
	list, err := m.svc.ListTenantFlags(req.Context(), chi.URLParam(req, "id"))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
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
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
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
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
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
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
}

func (m *Module) resolveErrorLog(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.ResolveErrorLog(req.Context(), chi.URLParam(req, "id")); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

// ===================== BLOG =====================

func (m *Module) listBlogPosts(w http.ResponseWriter, req *http.Request) {
	filter := parseListFilter(req)
	list, total, err := m.svc.ListBlogPosts(req.Context(), filter)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
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
	apphttp.Success(w, list, map[string]interface{}{"total": total, "page": filter.Page, "limit": filter.Limit})
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

func (m *Module) stopImpersonation(w http.ResponseWriter, req *http.Request) {
	// ponytail: 4 — real implementation clears the impersonation claim from the JWT.
	// Stub returns success; the frontend clears its client-side session state.
	apphttp.Success(w, map[string]bool{"stopped": true})
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
	// ponytail: 4 — real implementation bumps a pwa-nonce key in SystemSetting / Redis.
	apphttp.Success(w, map[string]string{"status": "force-updated"})
}

func (m *Module) aiChat(w http.ResponseWriter, req *http.Request) {
	// ponytail: 5 — stub. Real implementation forwards to the AI provider.
	var body map[string]interface{}
	_ = json.NewDecoder(req.Body).Decode(&body)
	apphttp.Success(w, map[string]interface{}{
		"reply":  "AI chat is not yet wired up.",
		"stub":   true,
	})
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
	return f
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(req.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
