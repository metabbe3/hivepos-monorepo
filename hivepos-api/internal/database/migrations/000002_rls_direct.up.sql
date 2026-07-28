-- 000002_rls_direct.up.sql
-- Phase 0 of tenant-isolation-via-RLS: enable Row-Level Security + attach a
-- tenant-scoping policy on the 14 tables that carry a DIRECT "tenantId" column.
--
-- SAFETY — this migration is INERT as written:
--   The app connects as `posadmin`, which OWNS these tables. Postgres table
--   owners (and BYPASSRLS roles) bypass RLS unless `FORCE ROW LEVEL SECURITY`
--   is set. This migration does NOT set FORCE. So after applying it, the app's
--   behavior is unchanged — the policies merely exist, validated and ready for
--   the Phase 1 enforcement flip (non-owner app role / FORCE).
--
-- Policy expression (single source: database.TenantPolicyExpr):
--   "tenantId" = NULLIF(current_setting('app.current_tenant', true), '')
--   - tenant GUC set (via TxBegin SET LOCAL) → matches that tenant's rows.
--   - GUC unset / NULL / '' → NULLIF yields NULL → matches zero rows
--     (SAFE-FAIL: empty result, never a cross-tenant leak).
--
-- The 12 INDIRECT tables (Order, Customer, Payment, Service, …) are scoped via
-- Branch."tenantId" and have NO direct column. They are Phase 0.5 (JOIN-based
-- policies) / Phase 2 (denormalize). Not touched here.

-- ── 10 NON-NULLABLE tenantId tables ──
ALTER TABLE "Branch"            ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Branch";
CREATE POLICY tenant_isolation ON "Branch" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "User"              ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "User";
CREATE POLICY tenant_isolation ON "User" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "Role"              ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Role";
CREATE POLICY tenant_isolation ON "Role" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "Subscription"      ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Subscription";
CREATE POLICY tenant_isolation ON "Subscription" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "SaaSPayment"       ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SaaSPayment";
CREATE POLICY tenant_isolation ON "SaaSPayment" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "PickupRequest"     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PickupRequest";
CREATE POLICY tenant_isolation ON "PickupRequest" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "PromoRedemption"   ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "PromoRedemption";
CREATE POLICY tenant_isolation ON "PromoRedemption" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "OrderPhoto"        ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderPhoto";
CREATE POLICY tenant_isolation ON "OrderPhoto" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "TenantFeatureFlag" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TenantFeatureFlag";
CREATE POLICY tenant_isolation ON "TenantFeatureFlag" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "ClockEvent"        ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ClockEvent";
CREATE POLICY tenant_isolation ON "ClockEvent" FOR ALL
  USING ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

-- ── 4 NULLABLE tenantId tables ──
-- These allow NULL tenantId (platform/system rows: client errors with no tenant,
-- system telemetry, anonymous tickets). Policy keeps NULL-tenant rows visible
-- (they are platform-owned, not tenant data) and scopes non-NULL rows to the
-- current tenant. Tradeoff under enforcement: NULL rows are visible to the
-- platform BYPASSRLS pool; tenant-scoped connections never see another tenant's.
ALTER TABLE "AuditLog"          ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "AuditLog";
CREATE POLICY tenant_isolation ON "AuditLog" FOR ALL
  USING ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "ErrorLog"          ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ErrorLog";
CREATE POLICY tenant_isolation ON "ErrorLog" FOR ALL
  USING ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "SupportTicket"     ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "SupportTicket";
CREATE POLICY tenant_isolation ON "SupportTicket" FOR ALL
  USING ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));

ALTER TABLE "TelemetryEvent"    ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TelemetryEvent";
CREATE POLICY tenant_isolation ON "TelemetryEvent" FOR ALL
  USING ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" IS NULL OR "tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));
