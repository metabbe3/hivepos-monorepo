package database

import (
	"context"
	"database/sql"
	"fmt"
)

// TenantGUC is the Postgres custom setting (a "GUC") that holds the current
// tenant id for Row-Level-Security policies. It is set per-transaction only
// (SET LOCAL via set_config(..., true)) so it can NEVER leak across pooled
// connections — pgx reuses connections, so a plain SET would bleed one tenant's
// scope into the next request on that connection.
const TenantGUC = "app.current_tenant"

// tenantGUCValue is what RLS policies compare "tenantId" against. Returns NULL
// when no tenant is set (GUC unset OR empty), which matches zero rows under a
// `"tenantId" = NULLIF(current_setting('app.current_tenant', true), '')` policy
// — the safe-fail behavior (empty result, never a cross-tenant leak).
//
// Kept here as the single source of the policy expression so the wrapper, the
// migration, and the test all agree on it.
const TenantPolicyExpr = `"tenantId" = NULLIF(current_setting('app.current_tenant', true), '')`

// TxBegin starts a transaction scoped to tenantID: it sets the tenant GUC with
// SET LOCAL on the same connection, so every query in the tx is RLS-isolated to
// that tenant. SET LOCAL auto-reverts at COMMIT/ROLLBACK — the setting never
// escapes this tx.
//
// Uses the parameterized set_config(name, value, is_local) form so a malformed
// tenantID can never become SQL (SET LOCAL '<x>' would).
//
// Phase 0 (RLS inert — owner bypasses): this is the ready path. Repos opt in by
// replacing db.BeginTx with TxBegin. Actual enforcement is the Phase 1 flip
// (non-owner app role / FORCE); until then this behaves like BeginTx.
func TxBegin(ctx context.Context, db *sql.DB, tenantID string) (*sql.Tx, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "SELECT set_config($1, $2, true)", TenantGUC, tenantID); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("set tenant GUC: %w", err)
	}
	return tx, nil
}

// TxNoTenant starts a transaction with the tenant GUC explicitly NULL — for
// platform/global work (background workers, system queries) that must not be
// scoped to a tenant. Under Phase 1 enforcement these run through a BYPASSRLS
// pool; until then this is equivalent to db.BeginTx.
func TxNoTenant(ctx context.Context, db *sql.DB) (*sql.Tx, error) {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	if _, err := tx.ExecContext(ctx, "SELECT set_config($1, NULL, true)", TenantGUC); err != nil {
		_ = tx.Rollback()
		return nil, fmt.Errorf("clear tenant GUC: %w", err)
	}
	return tx, nil
}
