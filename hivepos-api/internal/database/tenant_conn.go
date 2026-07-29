package database

import (
	"context"
	"database/sql"
)

// TenantConn is the Phase-1 reference pattern for request-scoped, RLS-isolated DB
// access. It pins a pooled connection for one request and sets the tenant GUC
// inside a transaction so every query (read AND write) in the request is scoped to
// that tenant by the database's RLS policies.
//
// Why a transaction (not SET): pgx reuses pooled connections, so a session-level
// SET would leak one tenant's GUC onto the next request sharing that conn. SET
// LOCAL inside a tx auto-reverts at commit, scoping the GUC to exactly this unit
// of work. The cost is that reads must also run in the tx — the price of
// DB-enforced isolation (today reads bypass tx entirely).
//
// STATUS: reference pattern + test only. NOT wired into repos yet — repos still
// query the shared *sql.DB as posadmin (superuser, bypasses RLS). The app-wide
// migration to TenantConn is the staging-gated Phase-1 cutover (docs/rls-rollout).
type TenantConn struct {
	tx *sql.Tx
}

// AcquireTenant begins a request tx on a pinned connection and sets the tenant GUC
// (SET LOCAL app.current_tenant). Caller must Commit/Rollback at request end.
func AcquireTenant(ctx context.Context, db *sql.DB, tenantID string) (*TenantConn, error) {
	tx, err := TxBegin(ctx, db, tenantID) // TxBegin does the SET LOCAL (see tx.go)
	if err != nil {
		return nil, err
	}
	return &TenantConn{tx: tx}, nil
}

// Tx exposes the scoped transaction for repos to query through. Under Phase-1,
// repos take this (or a ctx-carried *sql.Tx) instead of the raw *sql.DB.
func (t *TenantConn) Tx() *sql.Tx { return t.tx }

// Commit finalizes the request's tx (the GUC reverts automatically).
func (t *TenantConn) Commit() error { return t.tx.Commit() }

// Rollback aborts the request's tx.
func (t *TenantConn) Rollback() error { return t.tx.Rollback() }
