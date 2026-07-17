import { prisma } from "@/lib/prisma";

// ponytail: single source of truth for telemetry kinds. Adding a new kind =
// add to this array + the union. Payloads are loosely typed (Json) — each
// kind documents its own contract inline. Phases 4 & 5 fill in print +
// query.slow + web_vitals emit sites; this file is the foundation.
//
// Note: "client_error" is intentionally absent — ErrorLog already covers 5xx
// server errors with richer schema (requestId, stack, resolved state). Don't
// duplicate.

export const TELEMETRY_KINDS = [
  "print", // payload: { ok, ms, kind: "network"|"bluetooth"|"usb"|"browser", orderId?, error? }
  "query.slow", // payload: { sql, durationMs } — parameterized SQL (truncated) + duration
  "web_vitals", // payload: { route, lcp?, cls?, inp?, fcp? }
] as const;

export type TelemetryKind = (typeof TELEMETRY_KINDS)[number];

export function isTelemetryKind(v: unknown): v is TelemetryKind {
  return typeof v === "string" && (TELEMETRY_KINDS as readonly string[]).includes(v);
}

// ── Query helpers (super-admin Peripherals dashboard) ──

export async function getTelemetryStats(opts: { since: Date }) {
  const where = { createdAt: { gte: opts.since } };
  const [total, byKindRows] = await Promise.all([
    prisma.telemetryEvent.count({ where }),
    prisma.telemetryEvent.groupBy({
      by: ["kind"],
      where,
      _count: { _all: true },
    }),
  ]);
  const byKind: Record<string, number> = {};
  for (const r of byKindRows) byKind[r.kind] = r._count._all;
  return { total, byKind };
}

export async function getRecentTelemetry(opts: {
  kind?: TelemetryKind | "ALL";
  limit?: number;
}) {
  const limit = Math.min(opts.limit ?? 50, 200);
  const where = opts.kind && opts.kind !== "ALL" ? { kind: opts.kind } : {};
  return prisma.telemetryEvent.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      payload: true,
      tenantId: true,
      userId: true,
      createdAt: true,
    },
  });
}

// ponytail: manual purge via super-admin button. No automatic cron yet —
// early volume doesn't justify it. The composite indexes keep the DELETE
// cheap when we do add it. Upgrade path: node-cron or pg_cron.
export async function purgeTelemetryBefore(cutoff: Date): Promise<number> {
  const r = await prisma.telemetryEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return r.count;
}

// ── Printer aggregations (Phase 4) ──
// ponytail: raw SQL because Prisma groupBy can't compute percentiles on JSON
// payload fields. Filter on kind+createdAt hits the composite index. Upgrade
// path: materialized view if print volume grows large.

export interface PrinterStats {
  total: number;
  ok: number;
  failed: number;
  successRate: number; // 0..1
  p50Ms: number;
  p95Ms: number;
}

export async function getPrinterStats(opts: { since: Date }): Promise<PrinterStats> {
  const rows = await prisma.$queryRaw<Array<{
    total: bigint;
    ok: bigint;
    failed: bigint;
    p50: number | null;
    p95: number | null;
  }>>`
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE (payload->>'ok') = 'true') AS ok,
      COUNT(*) FILTER (WHERE (payload->>'ok') = 'false') AS failed,
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY (payload->>'ms')::int) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (payload->>'ms')::int) AS p95
    FROM "TelemetryEvent"
    WHERE kind = 'print' AND "createdAt" >= ${opts.since}
  `;
  const r = rows[0] ?? { total: BigInt(0), ok: BigInt(0), failed: BigInt(0), p50: null, p95: null };
  const total = Number(r.total);
  const ok = Number(r.ok);
  const failed = Number(r.failed);
  return {
    total,
    ok,
    failed,
    successRate: total === 0 ? 0 : ok / total,
    p50Ms: r.p50 ?? 0,
    p95Ms: r.p95 ?? 0,
  };
}

// Per-method (network/bluetooth/usb/browser) breakdown for the same window.
export interface PrinterMethodRow {
  id?: string; // satisfies DataTable's { id?: string } constraint
  method: string;
  total: number;
  ok: number;
  failed: number;
  p50Ms: number;
  p95Ms: number;
}

export async function getPrinterMethodStats(opts: { since: Date }): Promise<PrinterMethodRow[]> {
  const rows = await prisma.$queryRaw<Array<{
    method: string;
    total: bigint;
    ok: bigint;
    failed: bigint;
    p50: number | null;
    p95: number | null;
  }>>`
    SELECT
      (payload->>'kind') AS method,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE (payload->>'ok') = 'true') AS ok,
      COUNT(*) FILTER (WHERE (payload->>'ok') = 'false') AS failed,
      PERCENTILE_CONT(0.5)  WITHIN GROUP (ORDER BY (payload->>'ms')::int) AS p50,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (payload->>'ms')::int) AS p95
    FROM "TelemetryEvent"
    WHERE kind = 'print' AND "createdAt" >= ${opts.since}
    GROUP BY (payload->>'kind')
    ORDER BY total DESC
  `;
  return rows.map((r) => ({
    method: r.method,
    total: Number(r.total),
    ok: Number(r.ok),
    failed: Number(r.failed),
    p50Ms: r.p50 ?? 0,
    p95Ms: r.p95 ?? 0,
  }));
}

// ── Slow queries (Phase 5) ──
// ponytail: top N by p95, grouped by SQL fingerprint (the parameterized SQL
// template). Raw SQL is more actionable than model+operation for debugging —
// you see exactly which query shape is slow.

export interface SlowQueryRow {
  id?: string; // satisfies DataTable constraint
  sql: string;
  samples: number;
  p95Ms: number;
  maxMs: number;
}

export async function getSlowQueries(opts: {
  since: Date;
  limit?: number;
}): Promise<SlowQueryRow[]> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const rows = await prisma.$queryRaw<Array<{
    sql: string;
    samples: bigint;
    p95: number | null;
    max: number | null;
  }>>`
    SELECT
      (payload->>'sql') AS sql,
      COUNT(*) AS samples,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (payload->>'durationMs')::int) AS p95,
      MAX((payload->>'durationMs')::int) AS max
    FROM "TelemetryEvent"
    WHERE kind = 'query.slow' AND "createdAt" >= ${opts.since}
    GROUP BY (payload->>'sql')
    ORDER BY p95 DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    sql: r.sql,
    samples: Number(r.samples),
    p95Ms: r.p95 ?? 0,
    maxMs: r.max ?? 0,
  }));
}

// ── Web Vitals (Phase 5) ──
// ponytail: p75 per route, matching the Chrome UX Report / Core Web Vitals
// convention. Filters out routes with <2 samples — not statistically meaningful.

export interface WebVitalsRow {
  id?: string; // satisfies DataTable constraint
  route: string;
  samples: number;
  lcpP75: number;
  clsP75: number;
  inpP75: number;
  fcpP75: number;
}

export async function getWebVitals(opts: {
  since: Date;
  limit?: number;
}): Promise<WebVitalsRow[]> {
  const limit = Math.min(opts.limit ?? 10, 50);
  const rows = await prisma.$queryRaw<Array<{
    route: string;
    samples: bigint;
    lcp_p75: number | null;
    cls_p75: number | null;
    inp_p75: number | null;
    fcp_p75: number | null;
  }>>`
    SELECT
      (payload->>'route') AS route,
      COUNT(*) AS samples,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (payload->>'lcp')::int) AS lcp_p75,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (payload->>'cls')::float) AS cls_p75,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (payload->>'inp')::int) AS inp_p75,
      PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY (payload->>'fcp')::int) AS fcp_p75
    FROM "TelemetryEvent"
    WHERE kind = 'web_vitals' AND "createdAt" >= ${opts.since}
    GROUP BY (payload->>'route')
    HAVING COUNT(*) >= 2
    ORDER BY lcp_p75 DESC
    LIMIT ${limit}
  `;
  return rows.map((r) => ({
    route: r.route,
    samples: Number(r.samples),
    lcpP75: r.lcp_p75 ?? 0,
    clsP75: r.cls_p75 ?? 0,
    inpP75: r.inp_p75 ?? 0,
    fcpP75: r.fcp_p75 ?? 0,
  }));
}
