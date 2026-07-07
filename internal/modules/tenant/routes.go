package tenant

import (
	"database/sql"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/modules/tenant/application"
	"github.com/hivepos/api/internal/modules/tenant/domain"
	"github.com/hivepos/api/internal/modules/tenant/infrastructure"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

type Module struct {
	svc *application.Service
}

func NewModule(db *sql.DB) *Module {
	repo := infrastructure.NewPgTenantRepository(db)
	return &Module{svc: application.NewService(repo)}
}

// Register mounts the tenant-management endpoints under /api/tenant.
// Every route is tenant-scoped — the RequireTenant middleware upstream injects tenantId.
func (m *Module) Register(r chi.Router) {
	r.Get("/onboarding", m.getOnboarding)
	r.Patch("/onboarding", m.completeOnboarding)
	r.Get("/referral", m.getReferral)
	r.Get("/website", m.getWebsite)
	r.Patch("/website", m.updateWebsite)
	r.Delete("/website", m.deleteWebsite)
	r.Get("/whatsapp-templates", m.getWhatsAppTemplates)
	r.Patch("/whatsapp-templates", m.updateWhatsAppTemplates)
}

func (m *Module) getOnboarding(w http.ResponseWriter, req *http.Request) {
	t, err := m.svc.GetTenant(req.Context(), middleware.GetTenantID(req))
	if err != nil {
		apphttp.NotFoundError(w, "Tenant not found")
		return
	}
	apphttp.Success(w, map[string]interface{}{
		"onboardingCompletedAt": t.OnboardingCompletedAt,
		"activeModules":         t.ActiveModules,
		"settings":              t.Settings,
	})
}

func (m *Module) completeOnboarding(w http.ResponseWriter, req *http.Request) {
	var input application.CompleteOnboardingInput
	if !decodeJSON(w, req, &input) {
		return
	}
	t, err := m.svc.CompleteOnboarding(req.Context(), middleware.GetTenantID(req), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func (m *Module) getReferral(w http.ResponseWriter, req *http.Request) {
	info, err := m.svc.GetReferral(req.Context(), middleware.GetTenantID(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, info)
}

func (m *Module) getWebsite(w http.ResponseWriter, req *http.Request) {
	cfg, err := m.svc.GetWebsite(req.Context(), middleware.GetTenantID(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, cfg)
}

func (m *Module) updateWebsite(w http.ResponseWriter, req *http.Request) {
	var input application.WebsiteInput
	if !decodeJSON(w, req, &input) {
		return
	}
	cfg, err := m.svc.UpdateWebsite(req.Context(), middleware.GetTenantID(req), input)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, cfg)
}

func (m *Module) deleteWebsite(w http.ResponseWriter, req *http.Request) {
	if err := m.svc.DeleteWebsite(req.Context(), middleware.GetTenantID(req)); err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.NoContent(w)
}

func (m *Module) getWhatsAppTemplates(w http.ResponseWriter, req *http.Request) {
	t, err := m.svc.GetWhatsAppTemplates(req.Context(), middleware.GetTenantID(req))
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func (m *Module) updateWhatsAppTemplates(w http.ResponseWriter, req *http.Request) {
	var templates domain.WhatsAppTemplates
	if !decodeJSON(w, req, &templates) {
		return
	}
	t, err := m.svc.UpdateWhatsAppTemplates(req.Context(), middleware.GetTenantID(req), templates)
	if err != nil {
		apphttp.Error(w, http.StatusInternalServerError, err.Error())
		return
	}
	apphttp.Success(w, t)
}

func decodeJSON(w http.ResponseWriter, req *http.Request, dst interface{}) bool {
	if err := json.NewDecoder(req.Body).Decode(dst); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return false
	}
	return true
}
