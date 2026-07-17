/**
 * Migrate from cohort-based slot billing to per-outlet billing.
 *
 * For each tenant:
 *   1. Get all branches ordered by createdAt ASC
 *   2. Mark the first branch as isFreeTier = true
 *   3. Get the tenant's latestCoverageEnd from existing paid SaaSPayment cohorts
 *      (or subscription.currentPeriodEnd as fallback)
 *   4. For other branches: set coverageEnd = latestCoverageEnd (generous — all
 *      existing outlets get the max coverage from any cohort)
 *
 * Idempotent: only updates branches where isFreeTier = false AND coverageEnd IS NULL.
 *
 * Run with: npx tsx scripts/migrate-per-outlet.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Migrating to per-outlet billing model...\n");

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  if (tenants.length === 0) {
    console.log("  No tenants found.");
    return;
  }

  console.log(`  Found ${tenants.length} tenant(s).\n`);

  for (const tenant of tenants) {
    console.log(`  Tenant: ${tenant.name} (${tenant.id.slice(0, 8)})`);

    // Get all branches ordered by creation order
    const branches = await prisma.branch.findMany({
      where: { tenantId: tenant.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, createdAt: true, isFreeTier: true, coverageEnd: true },
    });

    if (branches.length === 0) {
      console.log(`    No branches. Skipping.\n`);
      continue;
    }

    // Determine latest coverage end from existing paid payments
    const paidPayments = await prisma.saaSPayment.findMany({
      where: { tenantId: tenant.id, status: "PAID" },
      select: { coverageEnd: true, outletCount: true },
    });

    let latestCoverageEnd: Date | null = null;
    for (const p of paidPayments) {
      if (p.coverageEnd && (!latestCoverageEnd || p.coverageEnd.getTime() > latestCoverageEnd.getTime())) {
        latestCoverageEnd = p.coverageEnd;
      }
    }

    // Fallback to subscription.currentPeriodEnd
    if (!latestCoverageEnd) {
      const sub = await prisma.subscription.findUnique({
        where: { tenantId: tenant.id },
        select: { currentPeriodEnd: true },
      });
      if (sub?.currentPeriodEnd) {
        latestCoverageEnd = sub.currentPeriodEnd;
      }
    }

    console.log(
      `    Branches: ${branches.length}, Latest coverage end: ${latestCoverageEnd?.toISOString().slice(0, 10) ?? "none"}`,
    );

    // Mark first branch as free tier (if not already set)
    const firstBranch = branches[0];
    if (!firstBranch.isFreeTier) {
      await prisma.branch.update({
        where: { id: firstBranch.id },
        data: { isFreeTier: true },
      });
      console.log(`    ✅ Branch "${firstBranch.name}" → FREE TIER`);
    }

    // Set coverageEnd on remaining branches that don't have it yet
    let updated = 0;
    for (let i = 1; i < branches.length; i++) {
      const branch = branches[i];
      if (!branch.coverageEnd && latestCoverageEnd) {
        await prisma.branch.update({
          where: { id: branch.id },
          data: { coverageEnd: latestCoverageEnd },
        });
        console.log(
          `    ✅ Branch "${branch.name}" → coverageEnd = ${latestCoverageEnd.toISOString().slice(0, 10)}`,
        );
        updated++;
      } else if (!branch.coverageEnd && !latestCoverageEnd) {
        // No coverage at all — branch stays locked (coverageEnd = null)
        console.log(`    ⚠️  Branch "${branch.name}" → no coverage (LOCKED)`);
      }
    }

    if (updated === 0 && firstBranch.isFreeTier) {
      console.log(`    (already migrated)`);
    }

    console.log(``);
  }

  console.log("✅ Per-outlet migration complete.");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
