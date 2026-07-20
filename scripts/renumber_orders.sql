-- One-shot: renumber legacy/imported order numbers to {CODE}-YYYYMMDD-NNNN,
-- matching Go's order_number.go (DeriveTenantCode + OrderNumberPrefix).
--   - CODE: derived from Tenant.slug (ORD / first-3 / initials≤5), uppercased
--   - date: receivedAt stored digits (Go's receivedAt.UTC() is identity on a
--           pgx-scanned naive timestamp; no AT TIME ZONE or it shifts +session-tz).
--   - seq:  per-(tenant, day) row_number ordered by receivedAt, createdAt
-- Deterministic + idempotent. Order has no tenantId col → join Branch→Tenant.
-- Global Order_orderNumber_key holds: codes differ per tenant; (day,seq) unique per tenant.

BEGIN;

-- Phase 1: move every orderNumber to a unique neutral namespace ('TMP-' || id).
-- Order_orderNumber_key is checked per-row during UPDATE, so a direct reshuffle collides
-- mid-statement when two rows swap values (e.g. ...-0001 <-> ...-0003). The TMP namespace
-- is disjoint from the final {CODE}-YYYYMMDD-NNNN namespace, so phase 2 never collides.
UPDATE "Order" SET "orderNumber" = 'TMP-' || id;

WITH parts AS (
  SELECT o.id,
         t.slug,
         b."tenantId",
         o."receivedAt",
         o."createdAt",
         array_remove(string_to_array(t.slug, '-'), '') AS seg
  FROM "Order" o
  JOIN "Branch"  b ON b.id = o."branchId"
  JOIN "Tenant" t ON t.id = b."tenantId"
),
coded AS (
  SELECT p.id,
         p."tenantId",
         p."receivedAt",
         p."createdAt",
         CASE
           WHEN cardinality(p.seg) = 0 THEN 'ORD'
           WHEN cardinality(p.seg) = 1 THEN left(upper(p.seg[1]), 3)
           ELSE left(upper((SELECT string_agg(left(x, 1), '') FROM unnest(p.seg) AS x)), 5)
         END AS code
  FROM parts p
),
ranked AS (
  SELECT c.id,
         c.code,
         to_char(c."receivedAt", 'YYYYMMDD') AS d,
         row_number() OVER (
           PARTITION BY c."tenantId", date_trunc('day', c."receivedAt")
           ORDER BY c."receivedAt", c."createdAt"
         ) AS seq
  FROM coded c
)
UPDATE "Order" o
SET "orderNumber" = r.code || '-' || r.d || '-' || lpad(r.seq::text, 4, '0')
FROM ranked r
WHERE o.id = r.id;

COMMIT;
