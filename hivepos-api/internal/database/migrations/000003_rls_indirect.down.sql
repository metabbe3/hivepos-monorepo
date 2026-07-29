-- 000003_rls_indirect.down.sql
-- Reverse Phase 0.5: drop the JOIN-based tenant-isolation policies and disable
-- RLS on the 12 indirect tables. Safe: re-enables owner/app access exactly as
-- today (the up migration was inert for posadmin anyway). Forward-fix preferred;
-- this is the clean rollback if a JOIN policy needs rework before enforcement.
DROP POLICY IF EXISTS tenant_isolation ON "TicketComment";
DROP POLICY IF EXISTS tenant_isolation ON "StockMovement";
DROP POLICY IF EXISTS tenant_isolation ON "Payment";
DROP POLICY IF EXISTS tenant_isolation ON "OrderItem";
DROP POLICY IF EXISTS tenant_isolation ON "DepositTransaction";
DROP POLICY IF EXISTS tenant_isolation ON "ExpenseCategory";
DROP POLICY IF EXISTS tenant_isolation ON "Expense";
DROP POLICY IF EXISTS tenant_isolation ON "StockItem";
DROP POLICY IF EXISTS tenant_isolation ON "ServiceGroup";
DROP POLICY IF EXISTS tenant_isolation ON "Service";
DROP POLICY IF EXISTS tenant_isolation ON "Customer";
DROP POLICY IF EXISTS tenant_isolation ON "Order";

ALTER TABLE "TicketComment"     DISABLE ROW LEVEL SECURITY;
ALTER TABLE "StockMovement"     DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Payment"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE "DepositTransaction" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseCategory"   DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Expense"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "StockItem"         DISABLE ROW LEVEL SECURITY;
ALTER TABLE "ServiceGroup"      DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Service"           DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Customer"          DISABLE ROW LEVEL SECURITY;
ALTER TABLE "Order"             DISABLE ROW LEVEL SECURITY;
