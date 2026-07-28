package telemetry

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/hivepos/api/internal/middleware"
	apphttp "github.com/hivepos/api/internal/shared/http"
)

// Module wires the telemetry endpoint (POST /api/telemetry).
type Module struct {
	db *sql.DB
}

func NewModule(db *sql.DB) *Module {
	return &Module{db: db}
}

// in-memory rate limiter (matches TS ponytail approach).
var (
	buckets = map[string]*bucket{}
	mu      sync.Mutex
)

type bucket struct {
	count   int
	resetAt time.Time
}

// Register mounts the telemetry endpoint.
func (m *Module) Register(w http.ResponseWriter, req *http.Request) {
	// The handler is registered directly in main.go as r.Post("/api/telemetry", ...)
	_ = w
	_ = req
}

// PostTelemetry handles POST /api/telemetry — accepts a batch of client-side
// events. Events with type "error" (or level "error") are persisted to ErrorLog
// so FE-only JS crashes surface in the super-admin error-logs viewer; everything
// else is accepted + discarded (analytics placeholder). Rate-limited 100/min/user.
func (m *Module) PostTelemetry(w http.ResponseWriter, req *http.Request) {
	// userID comes ONLY from the JWT claims (RequireAuth sets it in context).
	// Never trust a client-supplied X-User-Id header — it let an authed caller spoof
	// attribution AND rotate a fresh rate-limit bucket per request, bypassing the
	// 100/min cap → unbounded ErrorLog inserts. RequireAuth guarantees claims are set.
	userID := middleware.GetUserID(req)
	if userID == "" {
		apphttp.UnauthorizedError(w, "Authentication required")
		return
	}

	// Rate limit
	mu.Lock()
	b, ok := buckets[userID]
	now := time.Now()
	if !ok || now.After(b.resetAt) {
		buckets[userID] = &bucket{count: 1, resetAt: now.Add(time.Minute)}
		mu.Unlock()
	} else {
		if b.count >= 100 {
			mu.Unlock()
			apphttp.Error(w, http.StatusTooManyRequests, "Telemetry rate limit exceeded")
			return
		}
		b.count++
		mu.Unlock()
	}

	// Parse body
	var body struct {
		Events []map[string]interface{} `json:"events"`
	}
	if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
		apphttp.ValidationError(w, "Invalid JSON body")
		return
	}
	if len(body.Events) > 50 {
		apphttp.ValidationError(w, "Max 50 events per batch")
		return
	}

	tenantID := middleware.GetTenantID(req)
	for _, ev := range body.Events {
		// Only error events persist — keeps an analytics channel open without
		// flooding ErrorLog with non-error events.
		if strField(ev, "type") != "error" && strField(ev, "level") != "error" {
			continue
		}
		if err := insertClientError(req, m.db, userID, tenantID, ev); err != nil {
			log.Printf("telemetry: insert client error failed: %v", err)
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

// insertClientError maps a client error event onto an ErrorLog row (reuses the
// existing table — no schema change).
//
// ponytail: ErrorLog has no stack column → the stack trace is dropped. Upgrade
// path: add a stack column when the next Prisma migration runs (BE never alters
// schema — non-negotiable #1).
func insertClientError(req *http.Request, db *sql.DB, userID, tenantID string, ev map[string]interface{}) error {
	msg := strField(ev, "message")
	if len(msg) > 500 {
		msg = msg[:500]
	}
	url := strField(ev, "url")
	if len(url) > 1000 {
		url = url[:1000] // cap client-supplied url — disk-fill guard
	}
	if url == "" {
		url = "(client)"
	}
	code := strField(ev, "type")
	if len(code) > 100 {
		code = code[:100] // cap client-supplied type/code
	}
	if code == "" {
		code = "CLIENT_JS"
	}

	_, err := db.ExecContext(req.Context(), `
		INSERT INTO "ErrorLog" (id, "requestId", method, url, "httpStatus", code, message,
			"tenantId", "userId", "ipAddress", "userAgent", resolved, "createdAt")
		VALUES (gen_random_uuid()::text, gen_random_uuid()::text, 'CLIENT', $1, 0, NULLIF($2, ''), $3, NULLIF($4, ''), NULLIF($5, ''), $6, $7, false, NOW())`,
		url, code, msg, tenantID, userID, req.RemoteAddr, req.UserAgent())
	return err
}

func strField(ev map[string]interface{}, key string) string {
	v, ok := ev[key].(string)
	if !ok {
		return ""
	}
	return v
}
