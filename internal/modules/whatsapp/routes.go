package whatsapp

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module proxies WhatsApp gateway requests (Baileys microservice on :3001).
// The gateway maintains persistent Baileys sessions per tenant.
//
// Access control (3 layers, all must pass):
// 1. Global feature flag `whatsappAutomation` in FeatureFlag table (default OFF).
// 2. Per-tenant whitelist: `Tenant.settings.whatsappEnabled` (super-admin controls).
// 3. Per-tenant auto-send toggles: `whatsappAutoReceived`, `whatsappAutoReady`.
type Module struct {
	db    *sql.DB
	gwURL string // WhatsApp gateway base URL (e.g. http://whatsapp-gateway:3001)
}

func NewModule(db *sql.DB, gwURL string) *Module {
	return &Module{db: db, gwURL: strings.TrimRight(gwURL, "/")}
}

func (m *Module) Register(r chi.Router) {
	r.Get("/status", m.status)
	r.Get("/qr", m.qr)
	r.Post("/connect", m.connect)
	r.Post("/disconnect", m.disconnect)
	r.Post("/send", m.send)
}

// gate checks if WhatsApp is enabled for this tenant.
// Layer 1: global FeatureFlag `whatsappAutomation` must be enabled.
// Layer 2: tenant settings `whatsappEnabled` must be true.
// Returns true if both pass.
func (m *Module) gate(tenantID string) bool {
	if m.db == nil {
		return false
	}
	// Layer 1: global flag.
	var globalEnabled bool
	_ = m.db.QueryRow(`SELECT enabled FROM "FeatureFlag" WHERE key = 'whatsappAutomation'`).Scan(&globalEnabled)
	if !globalEnabled {
		return false
	}
	// Layer 2: tenant whitelist in settings JSON.
	var settingsJSON sql.NullString
	_ = m.db.QueryRow(`SELECT settings FROM "Tenant" WHERE id = $1`, tenantID).Scan(&settingsJSON)
	if !settingsJSON.Valid {
		return false
	}
	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(settingsJSON.String), &raw); err != nil {
		return false
	}
	v, _ := raw["whatsappEnabled"].(bool)
	return v
}

// proxyGET forwards a GET to the gateway's /:tenantId/<path>.
func (m *Module) proxyGET(w http.ResponseWriter, req *http.Request, path string) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	if !m.gate(tenantID) {
		apphttp.ForbiddenError(w, "WhatsApp automation is not enabled for this tenant")
		return
	}
	resp, err := http.Get(fmt.Sprintf("%s/%s/%s", m.gwURL, tenantID, path))
	if err != nil {
		apphttp.Error(w, http.StatusBadGateway, "WhatsApp gateway unreachable")
		return
	}
	defer resp.Body.Close()
	forwardJSON(w, resp)
}

// proxyPOST forwards a POST (with optional body) to the gateway.
func (m *Module) proxyPOST(w http.ResponseWriter, req *http.Request, path string) {
	tenantID := middleware.GetTenantID(req)
	if tenantID == "" {
		apphttp.ForbiddenError(w, "Missing tenant context")
		return
	}
	if !m.gate(tenantID) {
		apphttp.ForbiddenError(w, "WhatsApp automation is not enabled for this tenant")
		return
	}
	url := fmt.Sprintf("%s/%s/%s", m.gwURL, tenantID, path)
	httpReq, _ := http.NewRequestWithContext(req.Context(), http.MethodPost, url, req.Body)
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		apphttp.Error(w, http.StatusBadGateway, "WhatsApp gateway unreachable")
		return
	}
	defer resp.Body.Close()
	forwardJSON(w, resp)
}

func (m *Module) status(w http.ResponseWriter, req *http.Request)  { m.proxyGET(w, req, "status") }
func (m *Module) qr(w http.ResponseWriter, req *http.Request)      { m.proxyGET(w, req, "qr") }
func (m *Module) connect(w http.ResponseWriter, req *http.Request) { m.proxyPOST(w, req, "connect") }
func (m *Module) disconnect(w http.ResponseWriter, req *http.Request) {
	m.proxyPOST(w, req, "disconnect")
}

func (m *Module) send(w http.ResponseWriter, req *http.Request) {
	m.proxyPOST(w, req, "send")
}

func forwardJSON(w http.ResponseWriter, resp *http.Response) {
	body, _ := io.ReadAll(resp.Body)
	// Wrap the gateway's raw response in the standard {success, data} envelope
	// so FE apiFetch can read res.data correctly.
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		var data interface{}
		if err := json.Unmarshal(body, &data); err == nil {
			apphttp.Success(w, data)
			return
		}
	}
	// Non-2xx: pass through as-is (error envelope).
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode)
	w.Write(body)
}

// SendAsync is a fire-and-forget helper for auto-sending WhatsApp messages
// (order received, order ready). Called from order handlers as a goroutine.
// Silently fails if the gateway is down or the tenant isn't connected.
func (m *Module) SendAsync(tenantID, phone, message string) {
	go func() {
		url := fmt.Sprintf("%s/%s/send", m.gwURL, tenantID)
		body, _ := json.Marshal(map[string]string{"phone": phone, "message": message})
		resp, err := http.Post(url, "application/json", strings.NewReader(string(body)))
		if err != nil {
			return // gateway down — silently skip
		}
		resp.Body.Close()
	}()
}
