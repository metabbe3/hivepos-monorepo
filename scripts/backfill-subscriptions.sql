-- Backfill: tenants registered without a Subscription row (registration only
-- seeded Tenant+User+Branch) had none — super-admin plan-change/extend ops and
-- the tenant's own billing surface had no row to act on. Create a TRIAL
-- subscription on the Free plan for every tenant missing one, periodEnd aligned
-- to the tenant's trialEndsAt (or +60d fallback).
--
-- One-time data fix; new registrations now create the row (see
-- auth/infrastructure CreateTenantWithOwner step 5).
INSERT INTO "Subscription" (id, "tenantId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "paidOutletCount", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, t.id,
       (SELECT id FROM "Plan" WHERE lower(name) = 'free' LIMIT 1),
       'TRIAL', NOW(),
       COALESCE(t."trialEndsAt", NOW() + interval '60 days'),
       0, NOW(), NOW()
FROM "Tenant" t
WHERE NOT EXISTS (SELECT 1 FROM "Subscription" s WHERE s."tenantId" = t.id);
