/**
 * Backfill paidOutletCount + currentPeriodStart on existing subscriptions.
 * Run once after adding the new schema fields.
 *
 * For ACTIVE subscriptions:
 *   - paidOutletCount = max(1, activeBranchCount)
 *   - currentPeriodStart = currentPeriodEnd - 30 days (if null)
 *
 * Run with: npx tsx scripts/backfill-paid-outlets.ts
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔄 Backfilling paidOutletCount + currentPeriodStart...\n");

  const subs = await prisma.subscription.findMany({
    where: { status: "ACTIVE" },
  });

  if (subs.length === 0) {
    console.log("  No active subscriptions to backfill.");
    return;
  }

  for (const sub of subs) {
    const activeBranches = await prisma.branch.count({
      where: { tenantId: sub.tenantId, isActive: true },
    });

    const paidOutletCount = Math.max(1, activeBranches);

    let currentPeriodStart = sub.currentPeriodStart;
    if (!currentPeriodStart && sub.currentPeriodEnd) {
      const start = new Date(sub.currentPeriodEnd);
      start.setDate(start.getDate() - 30);
      currentPeriodStart = start;
    }

    await prisma.subscription.update({
      where: { id: sub.id },
      data: { paidOutletCount, currentPeriodStart },
    });

    console.log(
      `  ✅ ${sub.tenantId}: paidOutletCount=${paidOutletCount}, branches=${activeBranches}`,
    );
  }

  console.log(`\n✅ Backfilled ${subs.length} subscription(s).`);
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
