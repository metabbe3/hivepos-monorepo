-- 000002_rls_direct.down.sql
-- Reverse Phase 0: drop the tenant-isolation policies and disable RLS on the 14
-- direct "tenantId" tables. Safe: re-enables owner/app access exactly as today
-- (the up migration was inert for posadmin anyway). Forward-fix is preferred, but
-- this is the clean rollback if a policy needs rework before enforcement.
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
DROP POLICY IF EXISTS tenant_isolation ON "ErrorLog";
DROP POLICY IF EXISTS tenant_isolation ON "SupportTicket";
DROP POLICY IF EXISTS tenant_isolation ON "TelemetryEvent";
DROP POLICY IF EXISTS tenant_isolation ON "ClockEvent";
DROP POLICY IF EXISTS tenant_isolation ON "TenantFeatureFlag";
DROP POLICY IF EXISTS tenant_isolation ON "OrderPhoto";
DROP POLICY IF EXISTS tenant_isolation ON "PromoRedemption";
DROP POLICY IF EXISTS tenant_isolation ON "PickupRequest";
DROP POLICY IF EXISTS tenant_isolation ON "SaaSPayment";
DROP POLICY IF EXISTS tenant_isolation ON "Subscription";
DROP POLICY IF EXISTS tenant_isolation ON "Role";
DROP POLICY IF EXISTS tenant_isolation ON "User";
DROP POLICY IF EXISTS tenant_isolation ON "Branch";

ALTER TABLE "AuditLog"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ErrorLog"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SupportTicket"     DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TelemetryEvent"    DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ClockEvent"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE "TenantFeatureFlag" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderPhoto"        DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PromoRedemption"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "PickupRequest"     DISABLE ROW LEVEL SECURITY;
ALTER TABLE "SaaSPayment"       DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Subscription"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Role"              DISABLE ROW LEVEL SECURITY;
ALTER TABLE "User"              DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Branch"            DISABLE ROW LEVEL SECURITY;
