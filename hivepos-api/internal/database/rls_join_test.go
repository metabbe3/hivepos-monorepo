package database

import (
	"context"
	"database/sql"
	"errors"
	"testing"
)

// TestRLSJoinPolicyIsolation validates the JOIN-based policy used in migration
// 000003_rls_indirect for the 12 INDIRECT tables scoped via a parent's tenantId
// (e.g. Order/Customer/Service via Branch; OrderItem/Payment via Order). Proves
// the same four guarantees as the direct policy, with ZERO persistent change
// (temp tables on a pinned conn; SET ROLE to a non-superuser models enforcement,
// since posadmin is superuser and bypasses RLS).
func TestRLSJoinPolicyIsolation(t *testing.T) {
	db := rlsTestDB(t)
	defer db.Close()

	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		t.Fatalf("acquire conn: %v", err)
	}
	defer conn.Close()

	// Non-superuser role (posadmin bypasses RLS).
	mustExec(t, conn, ctx, `DROP ROLE IF EXISTS `+rlsTestRole)
	mustExec(t, conn, ctx, `CREATE ROLE `+rlsTestRole+` NOSUPERUSER NOBYPASSRLS NOLOGIN`)
	defer mustExecSilent(conn, ctx, `DROP ROLE IF EXISTS `+rlsTestRole)

	// Parent (Branch-like) + child (Order-like, scoped via branchId).
	mustExec(t, conn, ctx, `CREATE TEMP TABLE rls_branch (id text PRIMARY KEY, "tenantId" text NOT NULL)`)
	mustExec(t, conn, ctx, `CREATE TEMP TABLE rls_order (id text PRIMARY KEY, "branchId" text NOT NULL)`)
	mustExec(t, conn, ctx, `INSERT INTO rls_branch (id, "tenantId") VALUES ('bA','tenantA'), ('bB','tenantB')`)
	mustExec(t, conn, ctx, `INSERT INTO rls_order (id, "branchId") VALUES ('o1','bA'), ('o2','bB')`)

	// JOIN policy on the child — mirrors 000003 Pattern A/B.
	mustExec(t, conn, ctx, `ALTER TABLE rls_order ENABLE ROW LEVEL SECURITY`)
	mustExec(t, conn, ctx, `CREATE POLICY tenant_isolation ON rls_order FOR ALL
		USING (EXISTS (SELECT 1 FROM rls_branch WHERE rls_branch.id = rls_order."branchId" AND rls_branch."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
		WITH CHECK (EXISTS (SELECT 1 FROM rls_branch WHERE rls_branch.id = rls_order."branchId" AND rls_branch."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))`)
	mustExec(t, conn, ctx, `GRANT SELECT, INSERT ON rls_order, rls_branch TO `+rlsTestRole)

	mustExec(t, conn, ctx, `SET ROLE `+rlsTestRole)
	defer mustExecSilent(conn, ctx, `RESET ROLE`)

	setTenant := func(v string) {
		mustExec(t, conn, ctx, "SELECT set_config($1, $2, false)", TenantGUC, v)
	}
	countOrders := func() int {
		var n int
		if err := conn.QueryRowContext(ctx, `SELECT count(*) FROM rls_order`).Scan(&n); err != nil {
			t.Fatalf("count: %v", err)
		}
		return n
	}

	// 1 + 2: as tenantA, an UNFILTERED count sees only o1 (branch bA = tenantA).
	setTenant("tenantA")
	if n := countOrders(); n != 1 {
		t.Fatalf("tenantA: expected 1 order, got %d (cross-tenant leak)", n)
	}
	// tenantB's order invisible even when explicitly requested.
	var got string
	err = conn.QueryRowContext(ctx, `SELECT id FROM rls_order WHERE "branchId"='bB'`).Scan(&got)
	if !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("tenantA saw tenantB's order (got=%q err=%v) — LEAK", got, err)
	}

	// 3: no tenant → zero rows (safe-fail).
	setTenant("")
	if n := countOrders(); n != 0 {
		t.Fatalf("unset tenant: expected 0 orders (safe-fail), got %d", n)
	}

	// 4: WITH CHECK rejects a cross-tenant insert (branch bB belongs to tenantB).
	setTenant("tenantA")
	if _, err := conn.ExecContext(ctx, `INSERT INTO rls_order (id, "branchId") VALUES ('evil','bB')`); err == nil {
		t.Fatal("WITH CHECK failed to reject cross-tenant order INSERT — write isolation broken")
	}

	// Sanity: same-tenant insert allowed.
	if _, err := conn.ExecContext(ctx, `INSERT INTO rls_order (id, "branchId") VALUES ('o3','bA')`); err != nil {
		t.Fatalf("same-tenant insert should succeed, got: %v", err)
	}
}
