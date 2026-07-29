package database

import (
	"context"
	"testing"
)

// TestAcquireTenantSetsGUC proves TenantConn's mechanism: AcquireTenant begins a
// request tx and sets the tenant GUC on that connection (SET LOCAL). RLS policies
// compare "tenantId" against that GUC, so this is what scopes a request. Combined
// with TestRLSPolicyIsolation (GUC → enforced scoping), this validates the
// Phase-1 request pattern. Zero persistent change (rolled back).
func TestAcquireTenantSetsGUC(t *testing.T) {
	db := rlsTestDB(t)
	defer db.Close()

	ctx := context.Background()
	tc, err := AcquireTenant(ctx, db, "tenantXYZ")
	if err != nil {
		t.Fatalf("AcquireTenant: %v", err)
	}
	defer tc.Rollback()

	var got string
	if err := tc.Tx().QueryRowContext(ctx, "SELECT current_setting($1, true)", TenantGUC).Scan(&got); err != nil {
		t.Fatalf("read GUC: %v", err)
	}
	if got != "tenantXYZ" {
		t.Fatalf("GUC = %q, want tenantXYZ — TenantConn must SET LOCAL the tenant for RLS to scope the request", got)
	}
}
