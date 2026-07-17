package orders

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
)

// maybeSendWhatsAppReceipt checks if the tenant has WhatsApp auto-send enabled
// for "order received", then fires a best-effort message to the customer's phone.
// Called as a goroutine — never blocks or errors the order creation.
func (r *Module) maybeSendWhatsAppReceipt(_ context.Context, order interface{}, tenantID string) {
	// Layer 0: global feature flag must be ON.
	if !r.isWhatsAppGloballyEnabled() {
		return
	}
	// Layer 1+2: tenant settings — WhatsApp enabled + auto-receive ON?
	settings, err := r.loadTenantSettings(tenantID)
	if err != nil || !settings.whatsappEnabled || !settings.whatsappAutoReceived {
		return
	}

	// 2. Extract customer phone + order details from the order object.
	phone, msg := buildReceiptMessage(order)
	if phone == "" || msg == "" {
		return
	}

	// 3. Fire-and-forget POST to the WhatsApp gateway.
	gwURL := "http://localhost:3001"
	body, _ := json.Marshal(map[string]string{"phone": phone, "message": msg})
	_, _ = http.Post(gwURL+"/"+tenantID+"/send", "application/json", strings.NewReader(string(body)))
}

// maybeSendWhatsAppReady checks if the tenant has WhatsApp auto-send enabled
// for "order ready", then fires a best-effort "siap diambil" message.
func (r *Module) maybeSendWhatsAppReady(orderID, tenantID string) {
	// Layer 0: global feature flag must be ON.
	if !r.isWhatsAppGloballyEnabled() {
		return
	}
	settings, err := r.loadTenantSettings(tenantID)
	if err != nil || !settings.whatsappEnabled || !settings.whatsappAutoReady {
		return
	}

	// Load order detail to get customer phone + order number.
	phone, orderNumber := r.loadCustomerPhoneForOrder(orderID, tenantID)
	if phone == "" {
		return
	}

	msg := fmt.Sprintf("Pesanan #%s sudah siap diambil! 🎉\nTerima kasih telah menggunakan layanan kami.", orderNumber)
	gwURL := "http://localhost:3001"
	body, _ := json.Marshal(map[string]string{"phone": phone, "message": msg})
	_, _ = http.Post(gwURL+"/"+tenantID+"/send", "application/json", strings.NewReader(string(body)))
}

type tenantWhatsAppSettings struct {
	whatsappEnabled       bool
	whatsappAutoReceived  bool
	whatsappAutoReady     bool
}

// loadTenantSettings reads the Tenant.settings JSON column + parses WhatsApp flags.
// ponytail: flat parse — the settings JSON has many keys; we only care about these 3.
func (r *Module) loadTenantSettings(tenantID string) (*tenantWhatsAppSettings, error) {
	if r.db == nil {
		return &tenantWhatsAppSettings{}, nil
	}
	var settingsJSON sql.NullString
	err := r.db.QueryRow(`SELECT settings FROM "Tenant" WHERE id = $1`, tenantID).Scan(&settingsJSON)
	if err != nil || !settingsJSON.Valid {
		return &tenantWhatsAppSettings{}, err
	}
	var raw map[string]interface{}
	if err := json.Unmarshal([]byte(settingsJSON.String), &raw); err != nil {
		return &tenantWhatsAppSettings{}, nil
	}
	return &tenantWhatsAppSettings{
		whatsappEnabled:      boolVal(raw, "whatsappEnabled"),
		whatsappAutoReceived: boolVal(raw, "whatsappAutoReceived"),
		whatsappAutoReady:    boolVal(raw, "whatsappAutoReady"),
	}, nil
}

// loadCustomerPhoneForOrder gets the customer's phone + order number for the "ready" message.
func (r *Module) loadCustomerPhoneForOrder(orderID, tenantID string) (phone, orderNumber string) {
	if r.db == nil {
		return
	}
	var cp, on sql.NullString
	_ = r.db.QueryRow(`
		SELECT c.phone, o."orderNumber"
		FROM "Order" o LEFT JOIN "Customer" c ON c.id = o."customerId"
		JOIN "Branch" b ON b.id = o."branchId"
		WHERE o.id = $1 AND b."tenantId" = $2`, orderID, tenantID,
	).Scan(&cp, &on)
	if cp.Valid {
		phone = cp.String
	}
	if on.Valid {
		orderNumber = on.String
	}
	return
}

// buildReceiptMessage extracts phone + builds a receipt message from the order object.
// ponytail: the order is an interface{} (application's CreateOrderResult) — type-assert or use reflection.
func buildReceiptMessage(order interface{}) (phone, msg string) {
	// The order result from svc.Create is a map-like struct; extract via JSON round-trip.
	raw, _ := json.Marshal(order)
	var m map[string]interface{}
	if err := json.Unmarshal(raw, &m); err != nil {
		return
	}
	if v, ok := m["customerPhone"].(string); ok {
		phone = v
	}
	orderNumber, _ := m["orderNumber"].(string)
	customerName, _ := m["customerName"].(string)
	totalAmount := 0.0
	if v, ok := m["totalAmount"].(float64); ok {
		totalAmount = v
	}
	if phone == "" || orderNumber == "" {
		return
	}
	msg = fmt.Sprintf("Halo %s! ✨\n\nPesanan #%s telah kami terima.\nTotal: Rp %.0f\n\nLacak pesanan Anda di: http://localhost:3007/track/%s",
		customerName, orderNumber, totalAmount, orderNumber)
	return
}

// isWhatsAppGloballyEnabled checks the FeatureFlag table for the global kill-switch.
func (r *Module) isWhatsAppGloballyEnabled() bool {
	if r.db == nil {
		return false
	}
	var enabled bool
	err := r.db.QueryRow(`SELECT enabled FROM "FeatureFlag" WHERE key = 'whatsappAutomation'`).Scan(&enabled)
	if err != nil {
		return false // flag not found or DB error → OFF
	}
	return enabled
}

func boolVal(m map[string]interface{}, key string) bool {
	v, ok := m[key]
	if !ok {
		return false
	}
	b, _ := v.(bool)
	return b
}
