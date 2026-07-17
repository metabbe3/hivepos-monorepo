// Package health provides a DB-aware health handler. Mirrors the TS
// /api/health shape: { status, db, ts }.
package health

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"time"
)

// Handler pings the DB and reports liveness + DB reachability. Returns 503
// when the DB is unreachable so load balancers can drain.
func Handler(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		dbStatus := "up"
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if db == nil || db.PingContext(ctx) != nil {
			dbStatus = "down"
		}

		status := "ok"
		code := http.StatusOK
		if dbStatus == "down" {
			status = "degraded"
			code = http.StatusServiceUnavailable
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(code)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": status,
			"db":     dbStatus,
			"ts":     time.Now().UTC().Format(time.RFC3339),
		})
	}
}
