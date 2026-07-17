/**
 * Backfill coverageStart + coverageEnd on existing PAID SaaSPayment records.
 *
 * Processes payments chronologically per tenant:
 *   - RENEWAL/INITIAL: coverageStart = max(cursor, paidAt),
 *                       coverageEnd = addMonths(coverageStart, monthsPurchased)
 *   - TOPUP:           coverageStart = paidAt,
 *                       coverageEnd = cursor (or paidAt if orphaned)
 *
 * After updating payments, recomputes the subscription cache
 * (paidOutletCount + currentPeriodEnd) from the coverage cohorts.
 *
 * Idempotent: only updates payments where coverageStart IS NULL.
 *
 * Run with: npx tsx scripts/backfill-coverage.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

async function main() {
  console.log("🔄 Backfilling coverageStart + coverageEnd on PAID payments...\n");

  // Only backfill payments that don't have coverage dates yet (idempotent)
  const payments = await prisma.saaSPayment.findMany({
    where: {
      status: "PAID",
      coverageStart: null,
    },
    orderBy: [{ tenantId: "asc" }, { paidAt: "asc" }],
  });

  if (payments.length === 0) {
    console.log("  No payments to backfill.");
    return;
  }

  // Group by tenant
  const byTenant = new Map<string, typeof payments>();
  for (const p of payments) {
    if (!byTenant.has(p.tenantId)) byTenant.set(p.tenantId, []);
    byTenant.get(p.tenantId)!.push(p);
  }

  console.log(
    `  Found ${payments.length} payment(s) across ${byTenant.size} tenant(s).\n`,
  );

  let totalUpdated = 0;

  for (const [tenantId, tenantPayments] of byTenant) {
    // Cursor tracks the latest coverage end (for stacking renewals)
    let cursor: Date | null = null;

    for (const p of tenantPayments) {
      const paidAt = p.paidAt ?? p.createdAt;

      if (p.kind === "TOPUP") {
        // Topup: coverage starts at payment, ends at current cursor
        const coverageStart = paidAt;
        const coverageEnd = cursor ?? paidAt; // orphaned topup → point-in-time
        await prisma.saaSPayment.update({
          where: { id: p.id },
          data: { coverageStart, coverageEnd },
        });
        totalUpdated++;
        console.log(
          `    TOPUP   ${p.id.slice(0, 8)}: ${coverageStart.toISOString().slice(0, 10)} → ${coverageEnd.toISOString().slice(0, 10)} (${p.outletCount} outlet)`,
        );
      } else {
        // RENEWAL / INITIAL: stack on cursor
        const coverageStart =
          cursor && cursor.getTime() > paidAt.getTime() ? cursor : paidAt;
        const coverageEnd = addMonths(coverageStart, p.monthsPurchased);
        cursor = coverageEnd;
        await prisma.saaSPayment.update({
          where: { id: p.id },
          data: { coverageStart, coverageEnd },
        });
        totalUpdated++;
        console.log(
          `    ${p.kind.padEnd(8)} ${p.id.slice(0, 8)}: ${coverageStart.toISOString().slice(0, 10)} → ${coverageEnd.toISOString().slice(0, 10)} (${p.outletCount} outlet × ${p.monthsPurchased} mo)`,
        );
      }
    }

    // Recompute subscription cache for this tenant
    await recomputeSubscriptionCache(tenantId);
    console.log(`  ✅ Tenant ${tenantId.slice(0, 8)}: backfilled + cache recomputed\n`);
  }

  console.log(`✅ Backfilled ${totalUpdated} payment(s).`);
}

async function recomputeSubscriptionCache(tenantId: string) {
  const paidPayments = await prisma.saaSPayment.findMany({
    where: { tenantId, status: "PAID" },
    select: { outletCount: true, coverageStart: true, coverageEnd: true },
  });

  const now = new Date();
  let effectiveOutletCount = 0;
  let latestCoverageEnd: Date | null = null;

  for (const p of paidPayments) {
    if (p.coverageEnd) {
      if (
        !latestCoverageEnd ||
        p.coverageEnd.getTime() > latestCoverageEnd.getTime()
      ) {
        latestCoverageEnd = p.coverageEnd;
      }
    }
    if (
      p.coverageStart &&
      p.coverageEnd &&
      p.coverageStart.getTime() <= now.getTime() &&
      p.coverageEnd.getTime() > now.getTime()
    ) {
      effectiveOutletCount += p.outletCount;
    }
  }

  const existing = await prisma.subscription.findUnique({
    where: { tenantId },
  });
  if (existing) {
    await prisma.subscription.update({
      where: { tenantId },
      data: {
        status: "ACTIVE",
        paidOutletCount: effectiveOutletCount,
        currentPeriodEnd: latestCoverageEnd,
      },
    });
  } else if (effectiveOutletCount > 0) {
    // Create subscription if tenant has paid coverage but no sub row
    const plan = await prisma.plan.findUnique({ where: { name: "Growth" } });
    if (plan) {
      await prisma.subscription.create({
        data: {
          tenantId,
          planId: plan.id,
          status: "ACTIVE",
          paidOutletCount: effectiveOutletCount,
          currentPeriodEnd: latestCoverageEnd,
          currentPeriodStart: now,
        },
      });
    }
  }

  console.log(
    `    Cache: effective=${effectiveOutletCount}, latestEnd=${latestCoverageEnd?.toISOString().slice(0, 10) ?? "null"}`,
  );
}

main()
  .catch((e) => {
    console.error("❌ Backfill failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
