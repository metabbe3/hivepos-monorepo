-- 000003_rls_indirect.up.sql
-- Phase 0.5 of tenant-isolation-via-RLS: extend coverage to the 12 INDIRECT
-- tables — the core business tables with NO direct "tenantId" column. They are
-- scoped via Branch."tenantId" through a foreign-key chain.
--
-- SAFETY — INERT as written (same as 000002):
--   The app connects as `posadmin` (SUPERUSER, BYPASSRLS). Superusers bypass
--   RLS unconditionally — even FORCE won't bind them. This migration uses
--   ENABLE RLS without FORCE, so applying it changes NOTHING; the policies
--   merely exist, validated and ready for the Phase-1 enforcement flip
--   (non-superuser app role).
--
-- Policy shape: a correlated EXISTS that walks the FK chain to Branch."tenantId"
-- and compares against the tenant GUC:
--   NULLIF(current_setting('app.current_tenant', true), '')
--   - set (via TxBegin SET LOCAL) → matches that tenant's rows
--   - unset/NULL/'' → matches zero rows (SAFE-FAIL: empty result, never a leak)
--
-- Data-safety (verified before writing):
--   All 12 FK columns are NOT NULL, and there are ZERO NULL-FK rows in existing
--   data → under future enforcement no legitimate row is hidden.
--
-- Performance note: a correlated EXISTS evaluates per row. Acceptable at SMB
--   scale (Branch is tiny + indexed on id/tenantId). Phase 2 denormalizes a real
--   "tenantId" onto these tables to replace the EXISTS with a direct predicate.

-- ── Pattern A: scoped via Branch directly (branchId → Branch."tenantId") ──

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Order";
CREATE POLICY tenant_isolation ON "Order" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Order"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Order"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "Customer" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Customer";
CREATE POLICY tenant_isolation ON "Customer" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Customer"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Customer"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "Service" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Service";
CREATE POLICY tenant_isolation ON "Service" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Service"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Service"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "ServiceGroup" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ServiceGroup";
CREATE POLICY tenant_isolation ON "ServiceGroup" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "ServiceGroup"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "ServiceGroup"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "StockItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StockItem";
CREATE POLICY tenant_isolation ON "StockItem" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "StockItem"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "StockItem"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "Expense" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Expense";
CREATE POLICY tenant_isolation ON "Expense" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Expense"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "Expense"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "ExpenseCategory" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "ExpenseCategory";
CREATE POLICY tenant_isolation ON "ExpenseCategory" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "ExpenseCategory"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "ExpenseCategory"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "DepositTransaction" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "DepositTransaction";
CREATE POLICY tenant_isolation ON "DepositTransaction" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "DepositTransaction"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Branch" WHERE "Branch".id = "DepositTransaction"."branchId" AND "Branch"."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

-- ── Pattern B: scoped via Order → Branch (orderId → Order.branchId → Branch."tenantId") ──

ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "OrderItem";
CREATE POLICY tenant_isolation ON "OrderItem" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE o.id = "OrderItem"."orderId" AND b."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE o.id = "OrderItem"."orderId" AND b."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "Payment";
CREATE POLICY tenant_isolation ON "Payment" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE o.id = "Payment"."orderId" AND b."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "Order" o JOIN "Branch" b ON b.id = o."branchId" WHERE o.id = "Payment"."orderId" AND b."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

-- ── Pattern C: scoped via StockItem → Branch (stockItemId → StockItem.branchId → Branch."tenantId") ──

ALTER TABLE "StockMovement" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "StockMovement";
CREATE POLICY tenant_isolation ON "StockMovement" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "StockItem" si JOIN "Branch" b ON b.id = si."branchId" WHERE si.id = "StockMovement"."stockItemId" AND b."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')))
  WITH CHECK (EXISTS (SELECT 1 FROM "StockItem" si JOIN "Branch" b ON b.id = si."branchId" WHERE si.id = "StockMovement"."stockItemId" AND b."tenantId" = NULLIF(current_setting('app.current_tenant', true), '')));

-- ── Pattern D: scoped via SupportTicket (which carries a direct nullable "tenantId") ──

ALTER TABLE "TicketComment" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON "TicketComment";
CREATE POLICY tenant_isolation ON "TicketComment" FOR ALL
  USING  (EXISTS (SELECT 1 FROM "SupportTicket" st WHERE st.id = "TicketComment"."ticketId" AND (st."tenantId" IS NULL OR st."tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))))
  WITH CHECK (EXISTS (SELECT 1 FROM "SupportTicket" st WHERE st.id = "TicketComment"."ticketId" AND (st."tenantId" IS NULL OR st."tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))));
