# Tenant isolation via Postgres Row-Level Security (RLS) — rollout

## Why
Today every tenant-scoped query filters `WHERE "tenantId" = $X` in **application
code** ($X from the JWT claim). There is no DB-level enforcement, so one forgotten
`WHERE` = a silent cross-tenant leak. RLS makes isolation a **property of the
database**: a forgotten filter returns **zero rows (safe)**, never a leak.

## The policy
Every direct-tenant table gets:
```sql
CREATE POLICY tenant_isolation ON "<Table>" FOR ALL
  USING  ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''))
  WITH CHECK ("tenantId" = NULLIF(current_setting('app.current_tenant', true), ''));
```
- GUC set (per-tx, via `database.TxBegin` → `SET LOCAL`) → matches that tenant only.
- GUC unset/NULL/empty → `NULLIF` yields NULL → zero rows (safe-fail).
- `WITH CHECK` blocks writes (INSERT/UPDATE) that would place a row in another tenant.
Nullable-tenant tables (`AuditLog`, `ErrorLog`, `SupportTicket`, `TelemetryEvent`) use
`("tenantId" IS NULL OR …)` so platform/system rows (NULL tenant) stay visible.

Single source for the expression: `database.TenantPolicyExpr` (`internal/database/tx.go`).
The migration, the wrapper, and the test all reference it.

## Table inventory (from live schema)
- **14 DIRECT** (have `"tenantId" text`) → covered by migration `000002_rls_direct`:
  `Branch, User, Role, Subscription, SaaSPayment, PickupRequest, PromoRedemption,
  OrderPhoto, TenantFeatureFlag, ClockEvent` (NOT NULL) + `AuditLog, ErrorLog,
  SupportTicket, TelemetryEvent` (nullable). All indexed on `"tenantId"`.
- **12 INDIRECT** (scoped via `Branch."tenantId"`, NO direct column) — the **core**
  tables: `Order, OrderItem, Payment, Customer, Service, ServiceGroup, StockItem,
  StockMovement, Expense, ExpenseCategory, DepositTransaction, TicketComment`.
  → Phase 0.5 (JOIN-based policy) or Phase 2 (denormalize a `"tenantId"` column).
- **9 GLOBAL** (never RLS): `Tenant, Plan, SuperAdmin, SystemSetting, FeatureFlag,
  PromoCode, BlogPost, Referral, schema_migrations_go`.

## ⚠ Critical: posadmin is SUPERUSER → bypasses RLS unconditionally
The app connects as `posadmin`, which is `rolsuper=t` AND `rolbypassrls=t`.
**Superusers bypass RLS even with `FORCE ROW LEVEL SECURITY`.** Two consequences:

1. **Phase 0 is inert and safe:** migration `000002` uses `ENABLE RLS` (no FORCE).
   Since posadmin bypasses, applying it changes **nothing** — the policies merely
   exist, validated. (Confirmed: a normal tenant query still returns all its rows.)
2. **Enforcement needs a non-superuser app role — FORCE is not enough.** Phase 1
   MUST move the app off `posadmin` onto a role like `hivepos_app`
   (`NOSUPERUSER NOBYPASSRLS`). Only then does `ENABLE RLS` bind.

## Phases
- **Phase 0 — DONE (inert, no data risk).** `database.TxBegin`/`TxNoTenant` wrapper
  (`internal/database/tx.go`); migration `000002_rls_direct` (14 direct tables,
  ENABLE no FORCE); `TestRLSPolicyIsolation` proves the 4 guarantees on a temp table
  via `SET ROLE` to a non-superuser (models enforcement) — zero persistent change.
  Migration file written, **not applied** to the live DB this session; dry-run
  (`BEGIN; <up.sql>; ROLLBACK;`) confirmed all 14 policies CREATE cleanly.
- **Phase 0.5 — DONE (inert, no data risk).** JOIN-based policies on the 12
  indirect core tables (migration `000003_rls_indirect`); `TestRLSJoinPolicyIsolation`
  proves the same 4 guarantees. See "Phase 0.5 detail" below. RLS policy coverage
  is now total (14 direct + 12 indirect = all 26 tenant tables).
- **Phase 1 — enforcement (operator-driven, staging first).** See checklist below.
- **Phase 2 — denormalize (optional).** Add real `"tenantId"` to the 12 indirect
  tables + backfill, replacing JOIN policies with direct ones.

## Phase 0.5 detail — indirect tables (JOIN-based policies)
The 12 core tables have no direct `"tenantId"`; they're scoped via `Branch."tenantId"`
through a foreign-key chain. Migration `000003_rls_indirect` attaches a correlated
`EXISTS` policy per chain. All policies are `FOR ALL` (USING + WITH CHECK), `ENABLE
RLS`, no `FORCE` → inert (posadmin bypasses).

| Chain | Tables | EXISTS walks |
|---|---|---|
| `→ Branch` | `Order, Customer, Service, ServiceGroup, StockItem, Expense, ExpenseCategory, DepositTransaction` | `Branch.id = <t>."branchId"` |
| `→ Order → Branch` | `OrderItem, Payment` | `Order.id = <t>."orderId"` → `Branch.id = Order."branchId"` |
| `→ StockItem → Branch` | `StockMovement` | `StockItem.id = "stockItemId"` → `Branch` |
| `→ SupportTicket` (direct nullable tenantId) | `TicketComment` | `SupportTicket.id = "ticketId"` |

**Data-safety (verified before writing):** all 12 FK columns are `NOT NULL` and there
are **zero NULL-FK rows** in existing data → under future enforcement no legitimate
row is hidden. Re-confirm with:
```sql
SELECT 'Order' t, count(*) FROM "Order" WHERE "branchId" IS NULL
UNION ALL SELECT 'Payment', count(*) FROM "Payment" WHERE "orderId" IS NULL
UNION ALL SELECT 'OrderItem', count(*) FROM "OrderItem" WHERE "orderId" IS NULL
UNION ALL SELECT 'StockMovement', count(*) FROM "StockMovement" WHERE "stockItemId" IS NULL;
-- all must be 0 before flipping enforcement
```
**Perf:** a correlated EXISTS evaluates per row. Fine at SMB scale (Branch is tiny +
indexed on `id`/`"tenantId"`). Phase 2 denormalizes a real `"tenantId"` onto these
tables to replace the EXISTS with a direct predicate.

## Phase 1 enforcement runbook (STAGING-GATED — do NOT run on live without staging sign-off)
A missed tenant GUC makes rows vanish (looks like data loss) or blocks writes. Every
step below is verified on a staging clone first. The enforcement flip is the ONE
irreversible-ish step; everything else is reversible.

**Already scaffolded (safe, on `main`):**
- Migration `000005_rls_roles` — roles `hivepos_app` (NOSUPERUSER, NOBYPASSRLS) +
  `hivepos_admin` (NOSUPERUSER, BYPASSRLS) + grants + default-privileges. Applied via
  `cmd/migrate up`. Inert — app still connects as `posadmin`.
- `database.TenantConn` (`internal/database/tenant_conn.go`) — request-scoped tx +
  `SET LOCAL app.current_tenant` via `AcquireTenant`; the pattern repos adopt.
  `TestAcquireTenantSetsGUC` proves the GUC is set on the request connection.

**Remaining cutover (operator-driven, staging-verified):**
1. **Backup first** (always): fresh `backups/manual-full-*.sql.gz` + the 12h sidecar.
2. **Connection strategy — `SET ROLE` on connect.** Wire a pgx `AfterConnect` (or a
   `database/sql` opener) that runs `SET ROLE hivepos_app` on each pooled conn for the
   tenant-serving pool, and `SET ROLE hivepos_admin` for the worker/super-admin pool.
   (posadmin can SET ROLE to either; the session then drops superuser/bypass as that
   role.) This replaces changing the DSN credentials.
3. **Migrate repos to `TenantConn`.** Each tenant-scoped handler: `tc, _ := database.AcquireTenant(ctx, db, tenantID); defer tc.Rollback(); … tc.Tx().Query… ; tc.Commit()`. Global/workers use `TxNoTenant` (or the admin pool). **Audit every `*sql.DB` path** — any query not through the scoped tx bypasses RLS silently (the load-bearing risk). Migrate one module at a time.
4. **Two pools:** tenant pool (`hivepos_app`) for authed tenant routes; admin pool (`hivepos_admin`, BYPASSRLS) for background tickers + super-admin cross-tenant routes. Workers must use the admin pool or they read zero rows (cleanup stops).
5. **Staging verify (gate):** on a clone, exercise every endpoint per tenant — assert each returns ITS rows, none empty, no cross-tenant bleed. Re-run the NULL-FK check (Phase 0.5) — must stay 0.
6. **Flip:** point the tenant-serving pool at `hivepos_app` (SET ROLE). `FORCE` is NOT needed (hivepos_app isn't owner/superuser → `ENABLE RLS` already binds).
7. **Rollback:** revert pools to `posadmin` (or `RESET ROLE`). RLS stays defined but posadmin bypasses it. Fully reversible in seconds.

## Verification

## Verification
- `go test ./internal/database/... -run TestRLSPolicyIsolation -v` — proves isolation.
- Before applying `000002`: `gunzip -c backups/manual-full-*.sql.gz | docker exec -i
  hivepos-postgres-1 psql -U posadmin -d pos_saas`.
- Dry-run the migration (no persist): `{ echo BEGIN; cat …/000002_rls_direct.up.sql;
  echo ROLLBACK; } | docker exec -i hivepos-postgres-1 psql -U posadmin -d pos_saas -v ON_ERROR_STOP=1`.
- After applying: confirm a normal tenant query still returns all its rows (inert).
- Apply with `go run ./cmd/migrate up` (forward-only; `000002` is inert for posadmin).
