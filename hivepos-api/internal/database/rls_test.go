package database

import (
	"context"
	"database/sql"
	"errors"
	"os"
	"testing"
	"time"

	_ "github.com/jackc/pgx/v5/stdlib"
)

const connectTimeout = 10 * time.Second

// rlsTestRole is a non-superuser, NOBYPASSRLS role created for the test so RLS
// actually binds. posadmin is a SUPERUSER (rolsuper=t, rolbypassrls=t), and
// superusers bypass RLS unconditionally — even FORCE ROW LEVEL SECURITY won't
// bind them. This is exactly why Phase-1 enforcement MUST move the app off
// posadmin onto a non-superuser role; the test models that here.
const rlsTestRole = "rls_tester"

// rlsTestDB resolves a DB URL for the RLS integration test. Skips (not fails)
// when no DB is reachable so CI without a database doesn't break.
func rlsTestDB(t *testing.T) *sql.DB {
	t.Helper()
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "postgresql://posadmin:poslocal@localhost:5437/pos_saas?sslmode=disable"
	}
	db, err := sql.Open("pgx", dsn)
	if err != nil {
		t.Skipf("rls: open db: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), connectTimeout)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		t.Skipf("rls: db unreachable, skipping (%v)", err)
	}
	return db
}

// TestRLSPolicyIsolation validates the EXACT policy expression shipped in
// migration 000002_rls_direct (database.TenantPolicyExpr) against a throwaway
// TEMP table, proving the four Phase-0 guarantees with ZERO persistent change:
//
//  1. a tenant sees ONLY its own rows (cross-tenant leak impossible)
//  2. an UNFILTERED query is still scoped (forgotten WHERE → only current
//     tenant's rows, never all tenants)
//  3. no tenant set (GUC NULL/empty) → zero rows (SAFE-FAIL, not a leak)
//  4. a write for ANOTHER tenant is REJECTED by WITH CHECK
//
// Mechanics: posadmin is superuser and bypasses RLS, so the test SETs ROLE to a
// non-superuser role (rls_tester) — modeling the Phase-1 enforced state where
// the app connects as a non-superuser role. The temp table + policy vanish when
// the connection closes; rls_tester is dropped at the end. No real table touched.
func TestRLSPolicyIsolation(t *testing.T) {
	db := rlsTestDB(t)
	defer db.Close()

	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("acquire conn: %v", err)
	}
	defer conn.Close()

	// Idempotent setup of the non-superuser role (as superuser posadmin).
	mustExec(t, conn, ctx, `DROP ROLE IF EXISTS `+rlsTestRole)
	mustExec(t, conn, ctx, `CREATE ROLE `+rlsTestRole+` NOSUPERUSER NOBYPASSRLS NOLOGIN`)
	defer mustExecSilent(conn, ctx, `DROP ROLE IF EXISTS `+rlsTestRole)

	// Throwaway table mirroring a direct tenantId table's shape.
	mustExec(t, conn, ctx, `CREATE TEMP TABLE rls_probe (id text PRIMARY KEY, "tenantId" text NOT NULL)`)
	mustExec(t, conn, ctx, `INSERT INTO rls_probe (id, "tenantId") VALUES ('a1','tenantA'), ('b1','tenantB')`)

	// ENABLE RLS (no FORCE) + the policy — identical to migration 000002.
	mustExec(t, conn, ctx, `ALTER TABLE rls_probe ENABLE ROW LEVEL SECURITY`)
	mustExec(t, conn, ctx, `CREATE POLICY tenant_isolation ON rls_probe FOR ALL
		USING (`+TenantPolicyExpr+`)
		WITH CHECK (`+TenantPolicyExpr+`)`)
	// Grant access so the non-owner role can reach the table; the policy still gates rows.
	mustExec(t, conn, ctx, `GRANT SELECT, INSERT ON rls_probe TO `+rlsTestRole)

	// Become a non-superuser role → RLS now binds (models Phase-1 app role).
	mustExec(t, conn, ctx, `SET ROLE `+rlsTestRole)
	defer mustExecSilent(conn, ctx, `RESET ROLE`)

	setTenant := func(val string) {
		// session-level (is_local=false) on the pinned conn so it persists across
		// queries. Production uses SET LOCAL inside a tx (TxBegin).
		mustExec(t, conn, ctx, "SELECT set_config($1, $2, false)", TenantGUC, val)
	}
	countVisible := func() int {
		var n int
		if err := conn.QueryRowContext(ctx, `SELECT count(*) FROM rls_probe`).Scan(&n); err != nil {
			t.Fatalf("count: %v", err)
		}
		return n
	}

	// 1 + 2: as tenantA, an UNFILTERED count sees only tenantA's row (1), not both.
	setTenant("tenantA")
	if n := countVisible(); n != 1 {
		t.Fatalf("tenantA: expected 1 visible row, got %d (cross-tenant leak)", n)
	}

	// Cross-tenant row invisible even when explicitly asked for.
	var got string
	err = conn.QueryRowContext(ctx, `SELECT id FROM rls_probe WHERE "tenantId"='tenantB'`).Scan(&got)
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("tenantA saw tenantB's row (got=%q err=%v) — LEAK", got, err)
	}

	// 3: no tenant set → zero rows (safe-fail), never a leak.
	setTenant("")
	if n := countVisible(); n != 0 {
		t.Fatalf("unset tenant: expected 0 visible rows (safe-fail), got %d", n)
	}

	// 4: WITH CHECK rejects a write for another tenant.
	setTenant("tenantA")
	if _, err := conn.ExecContext(ctx, `INSERT INTO rls_probe (id, "tenantId") VALUES ('evil','tenantB')`); err == nil {
		t.Fatal("WITH CHECK failed to reject cross-tenant INSERT — write isolation broken")
	}

	// Sanity: a same-tenant write is allowed.
	if _, err := conn.ExecContext(ctx, `INSERT INTO rls_probe (id, "tenantId") VALUES ('a2','tenantA')`); err != nil {
		t.Fatalf("same-tenant insert should succeed, got: %v", err)
	}
}

func mustExec(t *testing.T, c *sql.Conn, ctx context.Context, q string, args ...interface{}) {
	t.Helper()
	if _, err := c.ExecContext(ctx, q, args...); err != nil {
		t.Fatalf("exec %q: %v", q, err)
	}
}

func mustExecSilent(c *sql.Conn, ctx context.Context, q string) {
	_, _ = c.ExecContext(ctx, q)
}
