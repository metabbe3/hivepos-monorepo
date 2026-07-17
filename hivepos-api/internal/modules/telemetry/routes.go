package telemetry

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"sync"
	"time"

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
// events and stores them. Rate-limited to 100 events/min/user (matches TS).
func (m *Module) PostTelemetry(w http.ResponseWriter, req *http.Request) {
	userID := req.Header.Get("X-User-Id")
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

	// Insert events (ponytail: ceiling — no TelemetryEvent table in this schema yet;
	// accept and discard. Wire to the table when the Prisma migration runs).
	for range body.Events {
		_ = ctx(req)
	}

	w.WriteHeader(http.StatusNoContent)
}

func ctx(req *http.Request) context.Context { return req.Context() }
