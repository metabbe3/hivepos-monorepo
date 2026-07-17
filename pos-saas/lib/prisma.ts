import { PrismaClient } from "@/app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// ponytail: slow-query threshold as env var so it can be tuned without redeploy.
// Default 200ms — PG queries under that are usually fine.
const SLOW_QUERY_MS = parseInt(process.env.SLOW_QUERY_MS ?? "200", 10);

// ponytail: throttle slow-query telemetry to ≤1 event/sec per process. Without
// this cap, a pool-starvation event (P2028 — every query slow/timing out) turns
// the capture into a write-amplification feedback loop: ~12M query.slow rows
// (5.9 GB) accumulated in ~2h. One sample per second is plenty to spot a
// slow-query hotspot; the volume cap is what stops the runaway.
const SLOW_LOG_MIN_INTERVAL_MS = 1000;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL!,
    // pg default (10) saturates under concurrent transactional load → Prisma
    // P2028 ("Unable to start a transaction in the given time") on any
    // $transaction (payments, force-update, register, …). The DB allows 100;
    // keep N replicas × DB_POOL_MAX below that. Tune via env without redeploy.
    max: parseInt(process.env.DB_POOL_MAX ?? "25", 10),
    // Best-practice timeouts (pg defaults are for CLI tools, not servers):
    idleTimeoutMillis: 30_000, // keep idle conns warm for bursts (default 10s closes too fast)
    connectionTimeoutMillis: 10_000, // fail fast if DB unreachable (default 0 = infinite → hang)
  });
  const adapter = new PrismaPg(pool);
  const base = new PrismaClient({
    adapter,
    // Best-practice: raise the default transaction wait so brief pool pressure
    // (burst of users) doesn't P2028. Default maxWait=2s caused the failures.
    transactionOptions: {
      maxWait: 5_000, // wait up to 5s for a connection (was 2s)
      timeout: 30_000, // run up to 30s (was 5s — too tight for heavy tx like demo seeding)
    },
    // ponytail: emit query events so we can time every operation. $on('query')
    // is the standard Prisma hook — doesn't change the client type (unlike
    // $extends) so existing Tx helpers keep working.
    log: [{ emit: "event", level: "query" }],
  });

  // Slow-query capture. The query event fires for every SQL statement
  // including those inside transactions. We log the parameterized SQL
  // template (safe — placeholders, no values) + duration. NOT params
  // (could contain user data).
  //
  // Volume cap: the SLOW_LOG_MIN_INTERVAL_MS throttle below bounds writes to
  // ≤1/sec regardless of how many queries go slow — a pool-starvation burst
  // can't balloon the table. Upgrade path: sample per SQL shape, or move
  // timing to a pg extension.
  let lastSlowLogAt = 0;
  base.$on("query", (e) => {
    if (e.duration <= SLOW_QUERY_MS) return;
    const now = Date.now();
    if (now - lastSlowLogAt < SLOW_LOG_MIN_INTERVAL_MS) return; // throttle
    lastSlowLogAt = now;
    void base.telemetryEvent
      .create({
        data: {
          kind: "query.slow",
          payload: {
            // ponytail: truncate SQL — some queries (INSERTs with large
            // JSON) can be several KB. 200 chars is enough to identify
            // the query shape.
            sql: e.query.slice(0, 200),
            durationMs: e.duration,
          } as unknown as object,
        },
      })
      .catch(() => {
        // ponytail: swallow — telemetry is fire-and-forget.
      });
  });

  return base;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Re-export Prisma namespace for transaction types
export { Prisma } from "@/app/generated/prisma/client";

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
