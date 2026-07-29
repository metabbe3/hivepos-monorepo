// Package jobs gives background tickers a durable run record.
//
// The photo-cleanup and self-heal tickers used to be purely in-memory: a crash
// mid-run left no trace of when they last ran or what they did. Start/Complete/Fail
// write a "JobRun" row so runs survive restarts and are queryable for ops.
//
// Scope (ponytail): this is observability + crash evidence, NOT distributed
// locking. The app runs a single instance today, so there is no lease. If multiple
// instances ever run, add a pg_advisory_lock per job_name at Start.
package jobs

import (
	"context"
	"database/sql"
	"encoding/json"
)

// Run is one execution of a background job. Start inserts a "running" row;
// Complete/Fail close it. Methods are best-effort (a recording failure is logged
// by the caller and never blocks the job itself).
type Run struct {
	id string
	db *sql.DB
}

// Start opens a JobRun row in "running" state. Returns (nil, err) if the insert
// failed (e.g. table not yet migrated) — callers should keep running the job
// anyway; recording is non-essential.
func Start(ctx context.Context, db *sql.DB, jobName string) (*Run, error) {
	r := &Run{db: db}
	err := db.QueryRowContext(ctx,
		`INSERT INTO "JobRun" (job_name, status) VALUES ($1, 'running') RETURNING id`,
		jobName).Scan(&r.id)
	if err != nil {
		return nil, err
	}
	return r, nil
}

// Complete marks the run finished, storing result (marshaled to JSON) if non-nil.
func (r *Run) Complete(ctx context.Context, result any) {
	if r == nil || r.id == "" {
		return
	}
	var payload any
	if result != nil {
		if b, err := json.Marshal(result); err == nil {
			payload = string(b) // $2::jsonb below casts the JSON text → jsonb
		}
	}
	_, _ = r.db.ExecContext(ctx,
		`UPDATE "JobRun" SET completed_at = NOW(), status = 'completed', result = $2::jsonb WHERE id = $1`,
		r.id, payload)
}

// Fail marks the run failed with the error message.
func (r *Run) Fail(ctx context.Context, err error) {
	if r == nil || r.id == "" || err == nil {
		return
	}
	_, _ = r.db.ExecContext(ctx,
		`UPDATE "JobRun" SET completed_at = NOW(), status = 'failed', error_message = $2 WHERE id = $1`,
		r.id, err.Error())
}
