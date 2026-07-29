// Package selfheal contains background jobs that detect failures and take
// guardrailed action (alert + open a ticket). Phase 1 of self-healing.
//
// Guardrail (enforced by design): these jobs OPEN a ticket + ALERT only.
// They never resolve the underlying error, touch money, edit code, or delete
// data. A human acts on the ticket.
package selfheal

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"

	"github.com/hivepos/api/internal/shared/jobs"
)

// Config for the alert ticker.
type Config struct {
	WebhookURL     string // empty → skip the network call (ticket still opens)
	ErrorThreshold int    // min errors per fingerprint in the window to alert. default 10
	WindowMinutes  int    // lookback window. default 10
}

type spike struct {
	Method     string
	URL        string
	Code       string // coalesced '-' when NULL
	HTTPStatus int
	Count      int
	Sample     sql.NullString
}

func (s spike) fingerprint() string {
	return fmt.Sprintf("%s %s [%s %d]", s.Method, s.URL, s.Code, s.HTTPStatus)
}

// RunAlertTicker scans ErrorLog for spikes every interval. For each fingerprint
// crossing the threshold with no OPEN ticket, it fires the webhook + opens a
// SupportTicket. Best-effort, non-blocking; honors ctx cancellation on shutdown.
func RunAlertTicker(ctx context.Context, db *sql.DB, interval time.Duration, cfg Config) {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			// Record this scan durably (JobRun) — observability + crash evidence.
			// Best-effort; a nil run means the table isn't migrated yet.
			run, _ := jobs.Start(ctx, db, "self_heal_alert")
			if err := scanAndAlert(ctx, db, cfg); err != nil {
				log.Printf("self-heal alert scan error: %v", err)
				if run != nil {
					run.Fail(ctx, err)
				}
			} else if run != nil {
				run.Complete(ctx, map[string]any{"status": "ok"})
			}
		case <-ctx.Done():
			return
		}
	}
}

func scanAndAlert(ctx context.Context, db *sql.DB, cfg Config) error {
	threshold := cfg.ErrorThreshold
	if threshold <= 0 {
		threshold = 10
	}
	window := cfg.WindowMinutes
	if window <= 0 {
		window = 10
	}

	rows, err := db.QueryContext(ctx, `
		SELECT method, url, COALESCE(code, '-') AS code, "httpStatus", COUNT(*) AS n,
		       (ARRAY_AGG(message) FILTER (WHERE message IS NOT NULL))[1] AS sample
		FROM "ErrorLog"
		WHERE resolved = false AND "createdAt" > NOW() - $1::interval
		GROUP BY method, url, COALESCE(code, '-'), "httpStatus"
		HAVING COUNT(*) >= $2`,
		fmt.Sprintf("%d minutes", window), threshold)
	if err != nil {
		return err
	}
	var spikes []spike
	for rows.Next() {
		var s spike
		if err := rows.Scan(&s.Method, &s.URL, &s.Code, &s.HTTPStatus, &s.Count, &s.Sample); err != nil {
			rows.Close()
			return err
		}
		spikes = append(spikes, s)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, s := range spikes {
		if err := handleSpike(ctx, db, cfg, s); err != nil {
			log.Printf("self-heal: spike %s: %v", s.fingerprint(), err)
		}
	}
	return nil
}

func handleSpike(ctx context.Context, db *sql.DB, cfg Config, s spike) error {
	subject := "[AUTO] Error spike: " + s.fingerprint()

	// Dedup: skip if an OPEN ticket already tracks this exact fingerprint.
	// ponytail: dedup by subject string, not a dedicated column — avoids a schema
	// change (BE never alters schema). Ceiling: if a human resolves the ticket but
	// the error keeps spiking, the next scan re-opens one. Acceptable re-alert.
	var exists int
	err := db.QueryRowContext(ctx,
		`SELECT 1 FROM "SupportTicket" WHERE status = 'OPEN' AND subject = $1 LIMIT 1`, subject,
	).Scan(&exists)
	if err == nil {
		return nil // open ticket exists → skip
	}
	if err != sql.ErrNoRows {
		return err
	}

	desc := fmt.Sprintf(
		"%d occurrences in the last %d minutes.\nFingerprint: %s\nRepresentative message: %s\n\nReview at /super-admin/error-logs",
		s.Count, cfg.WindowMinutes, s.fingerprint(), s.Sample.String,
	)

	if cfg.WebhookURL != "" {
		fireWebhook(cfg.WebhookURL, subject, desc)
	}

	_, err = db.ExecContext(ctx, `
		INSERT INTO "SupportTicket" (id, subject, description, category, priority, status,
		    "tenantId", "submitterName", "submitterEmail", "submitterPhone", "submittedById", "userAgent", "createdAt", "updatedAt")
		VALUES (gen_random_uuid()::text, $1, $2, 'OTHER', 'NORMAL', 'OPEN',
		    NULL, 'System (auto)', '', '', NULL, 'hivepos-api/self-healing', NOW(), NOW())`,
		subject, desc)
	if err != nil {
		return fmt.Errorf("open ticket: %w", err)
	}
	log.Printf("self-heal: opened ticket for spike %s (%d errors)", s.fingerprint(), s.Count)
	return nil
}

// webhookClient is reused across fires so repeated alerts to the same receiver
// reuse pooled connections instead of allocating a fresh Transport each call.
var webhookClient = &http.Client{Timeout: 5 * time.Second}

// fireWebhook POSTs a Slack/Discord-compatible {text} payload. Best-effort,
// never blocks the ticker on a slow/hung receiver.
func fireWebhook(url, subject, desc string) {
	body, _ := json.Marshal(map[string]string{"text": subject + "\n" + desc})
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := webhookClient.Do(req)
	if err != nil {
		log.Printf("self-heal: webhook post failed: %v", err)
		return
	}
	resp.Body.Close()
}
