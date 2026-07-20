package superadmin

import (
	"context"
	"log"
)

// SeedFeatureFlags idempotently upserts the platform feature-flag catalog.
// Ports pos-saas/prisma/seed-flags.ts into the Go backend so the super-admin
// flags page + RequireFeatureFlag gate have rows to work with.
//
// ponytail: ON CONFLICT(key) DO UPDATE refreshes name/category but never resets
// `enabled` — super-admin toggles survive reseed (same contract as seed-flags.ts).
// Runs once on boot; best-effort — never fatal.
func (m *Module) SeedFeatureFlags(ctx context.Context) {
	type flag struct {
		key, name, category string
		enabled             bool
	}
	catalog := []flag{
		{"dashboard", "Dashboard", "general", true},
		{"orders", "Orders", "operations", true},
		{"customers", "Customers", "operations", true},
		{"services", "Services & Pricing", "operations", true},
		{"inventory", "Inventory", "operations", true},
		{"expenses", "Expenses", "operations", true},
		{"deposits", "Customer Deposits", "operations", true},
		{"pickupRequests", "Pickup Requests", "operations", true},
		{"reports", "Reports", "operations", true},
		{"branches", "Outlet Management", "admin", true},
		{"users", "Staff Management", "admin", true},
		{"roles", "Role Management", "admin", true},
		{"billing", "Billing & Subscription", "admin", true},
		{"website", "Public Website", "growth", true},
		{"tickets", "Help / Bantuan", "general", true},
		{"offlineOrderCreate", "Offline Order Create", "general", false},
		{"printerSettings", "Printer Settings", "general", true},
		{"orderPhotos", "Order Proof Photos", "operations", true},
		{"referralProgram", "Referral Program", "growth", true},
		{"customersImportExport", "Customer CSV Import/Export", "operations", true},
		{"onboardingWizard", "Onboarding Wizard", "growth", true},
		{"orderFlowV2", "Order Flow V2 (leaner steps)", "operations", true},
		{"staffAttendance", "Staff Attendance (clock-in)", "operations", false},
	}

	const q = `INSERT INTO "FeatureFlag" (id, key, name, category, enabled, "updatedAt")
VALUES (gen_random_uuid()::text, $1, $2, $3, $4, NOW())
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, "updatedAt" = NOW()`

	var n int
	for _, f := range catalog {
		if _, err := m.db.ExecContext(ctx, q, f.key, f.name, f.category, f.enabled); err != nil {
			log.Printf("seed feature-flag %q: %v (continuing)", f.key, err)
			continue
		}
		n++
	}
	log.Printf("✓ Seeded %d/%d feature flags", n, len(catalog))
}
