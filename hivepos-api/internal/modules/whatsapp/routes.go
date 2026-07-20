package whatsapp

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/hivepos/api/internal/middleware"
	"github.com/hivepos/api/internal/shared/resilience"
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
	// cb trips after repeated gateway-unreachable failures so callers fast-fail
	// instead of queuing behind a dead dependency.
	cb *resilience.CircuitBreaker
}

func NewModule(db *sql.DB, gwURL string) *Module {
	return &Module{
		db:    db,
		gwURL: strings.TrimRight(gwURL, "/"),
		// Counts TRANSPORT errors only (HTTP status passes through) — a 4xx from
		// the gateway is a caller problem, not a dependency-health signal.
		cb: resilience.NewCircuitBreaker(5, 30*time.Second),
	}
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
	if err := m.db.QueryRow(`SELECT enabled FROM "FeatureFlag" WHERE key = 'whatsappAutomation'`).Scan(&globalEnabled); err != nil {
		log.Printf("whatsapp gate: feature flag lookup failed: %v", err)
	}
	if !globalEnabled {
		return false
	}
	// Layer 2: tenant whitelist in settings JSON.
	var settingsJSON sql.NullString
	if err := m.db.QueryRow(`SELECT settings FROM "Tenant" WHERE id = $1`, tenantID).Scan(&settingsJSON); err != nil {
		log.Printf("whatsapp gate: tenant settings lookup failed: %v", err)
	}
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

// gatewayDo runs req through the circuit breaker. Returns the response, or
// resilience.ErrCircuitOpen when the breaker is tripped. Centralized so every
// proxy route gets breaker protection without re-wrapping each call site.
func (m *Module) gatewayDo(req *http.Request) (*http.Response, error) {
	var resp *http.Response
	err := m.cb.Do(func() error {
		r, e := http.DefaultClient.Do(req)
		resp = r
		return e
	})
	return resp, err
}

// writeGatewayError maps a gatewayDo error to the right HTTP status.
func writeGatewayError(w http.ResponseWriter, err error) {
	if errors.Is(err, resilience.ErrCircuitOpen) {
		apphttp.Error(w, http.StatusServiceUnavailable, "WhatsApp gateway temporarily unavailable")
		return
	}
	apphttp.Error(w, http.StatusBadGateway, "WhatsApp gateway unreachable")
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
	gwReq, err := http.NewRequestWithContext(req.Context(), http.MethodGet,
		fmt.Sprintf("%s/%s/%s", m.gwURL, tenantID, path), nil)
	if err != nil {
		writeGatewayError(w, err)
		return
	}
	resp, err := m.gatewayDo(gwReq)
	if err != nil {
		writeGatewayError(w, err)
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
	httpReq, err := http.NewRequestWithContext(req.Context(), http.MethodPost,
		fmt.Sprintf("%s/%s/%s", m.gwURL, tenantID, path), req.Body)
	if err != nil {
		writeGatewayError(w, err)
		return
	}
	httpReq.Header.Set("Content-Type", "application/json")
	resp, err := m.gatewayDo(httpReq)
	if err != nil {
		writeGatewayError(w, err)
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
		req, err := http.NewRequest(http.MethodPost, url, strings.NewReader(string(body)))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		resp, err := m.gatewayDo(req)
		if err == nil && resp != nil {
			resp.Body.Close()
		}
		// breaker-open or gateway-down → skip silently (fire-and-forget)
	}()
}
