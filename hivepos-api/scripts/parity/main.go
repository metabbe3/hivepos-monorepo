// parity fires a list of GET endpoints at both backends and diffs status + shape.
// Auth is shared (one JWE token validates on both). Volatile keys are stripped
// before shape comparison.
//
// Usage: go run ./scripts/parity <goBase> <tsBase> <token>
//   e.g. go run ./scripts/parity http://localhost:8099 http://localhost:3007 "$TOK"
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"time"
)

var endpoints = []string{
	// CRUD lists
	"/api/orders",
	"/api/customers",
	"/api/services",
	"/api/service-groups",
	"/api/branches",
	"/api/stock-items",
	"/api/expenses",
	"/api/expense-categories",
	"/api/users",
	"/api/roles",
	"/api/attendance/staff",
	"/api/attendance/status",
	"/api/attendance/events",
	"/api/pickup-requests",
	"/api/pickup-requests/count-pending",
	// dashboard
	"/api/dashboard",
	"/api/dashboard/stats",
	"/api/dashboard/kanban",
	"/api/dashboard/heatmap",
	// reports (all)
	"/api/reports/orders",
	"/api/reports/revenue",
	"/api/reports/profit",
	"/api/reports/expenses",
	"/api/reports/customers",
	"/api/reports/monthly-pnl",
	"/api/reports/outstanding",
	"/api/reports/payment-collection",
	"/api/reports/services",
	"/api/reports/commission",
	"/api/reports/attendance",
	"/api/reports/inventory",
	"/api/reports/piutang-tracker",
	"/api/reports/financial-statement",
	"/api/reports/export",
	// auth
	"/api/auth/me",
	// tenant
	"/api/tenant/onboarding",
	"/api/tenant/referral",
	"/api/tenant/website",
	"/api/tenant/whatsapp-templates",
	// billing
	"/api/billing/status",
}

var volatile = map[string]bool{
	"createdAt": true, "updatedAt": true, "ts": true, "lastLoginAt": true,
	"expiresAt": true, "iat": true, "exp": true, "jti": true,
}

func main() {
	goBase, tsBase, tok := os.Args[1], os.Args[2], os.Args[3]
	client := &http.Client{Timeout: 10 * time.Second}

	fmt.Println("| endpoint | GO | TS | verdict |")
	fmt.Println("|---|---|---|---|")
	for _, ep := range endpoints {
		gStatus, gShape := fire(client, goBase+ep, tok)
		tStatus, tShape := fire(client, tsBase+ep, tok)
		verdict := verdict(gStatus, tStatus, gShape, tShape)
		fmt.Printf("| `%s` | %d | %d | %s |\n", ep, gStatus, tStatus, verdict)
	}
}

func fire(c *http.Client, url, tok string) (int, string) {
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	resp, err := c.Do(req)
	if err != nil {
		return 0, "ERR:" + err.Error()
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, shape(body)
}

// shape returns a canonicalized top-level key fingerprint of the envelope.
func shape(body []byte) string {
	var m map[string]any
	if err := json.Unmarshal(body, &m); err != nil {
		return "<non-json>"
	}
	stripVolatile(m)
	return fingerprint(m)
}

func stripVolatile(m map[string]any) {
	for k := range m {
		if volatile[k] {
			delete(m, k)
		}
		if sub, ok := m[k].(map[string]any); ok {
			stripVolatile(sub)
		}
	}
}

func fingerprint(v any) string {
	switch t := v.(type) {
	case map[string]any:
		keys := make([]string, 0, len(t))
		for k := range t {
			keys = append(keys, k)
		}
		sort.Strings(keys)
		parts := make([]string, 0, len(keys))
		for _, k := range keys {
			parts = append(parts, k+":"+fingerprint(t[k]))
		}
		return "{" + strings.Join(parts, ",") + "}"
	case []any:
		if len(t) == 0 {
			return "[]"
		}
		return "[]" + fingerprint(t[0])
	default:
		return "?"
	}
}

func verdict(gStatus, tStatus int, gShape, tShape string) string {
	if gStatus == 0 || tStatus == 0 {
		return "ERROR"
	}
	if gStatus != tStatus {
		return fmt.Sprintf("MISMATCH(status %d≠%d)", gStatus, tStatus)
	}
	if gStatus != 200 {
		return fmt.Sprintf("MATCH(%d)", gStatus)
	}
	if gShape == tShape {
		return "MATCH"
	}
	return "SHAPE-DIFF"
}
