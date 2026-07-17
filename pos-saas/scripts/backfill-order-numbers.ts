/**
 * Renumber all ORD-* orders to tenant-prefixed format.
 *
 *   ORD-20260613-0017  →  HBL-20260613-0001  (when run on a fresh DB)
 *   ORD-20260613-0029  →  HBL-20260613-0022  (when HBL-..-0021 already exists)
 *
 * Groups by (tenant, YYYYMMDD), sorts by createdAt, renumbers within each
 * group. Sequence continues from the max existing HBL-* sequence for that
 * date+tenant, so re-running after a migrate-from-laundry sync appends
 * safely without colliding with previously-backfilled orders.
 *
 * Idempotent: skips orders whose orderNumber already starts with the
 * derived tenant code for that tenant.
 *
 * Run with: npx tsx scripts/backfill-order-numbers.ts
 *
 * ponytail: destructive, no down-migration. Old ORD-* URLs will 404 after
 * this runs. Only one tenant in the system today (~200 orders). Revisit
 * when collision risk across tenants grows.
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { deriveTenantCode } from "../lib/tenant-code";
import { parseSequence } from "../modules/orders/domain/order-number.vo";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ORD_RE = /^ORD-(\d{8})-\d{4}$/;

async function main() {
  console.log("🔄 Backfilling order numbers to tenant-prefixed format...\n");

  const tenants = await prisma.tenant.findMany({
    select: { id: true, slug: true, name: true },
  });
  console.log(`  Found ${tenants.length} tenant(s).`);

  let totalRenumbered = 0;
  let totalSkipped = 0;

  for (const tenant of tenants) {
    const code = deriveTenantCode(tenant.slug ?? tenant.id);
    console.log(`\n  Tenant ${tenant.name} (slug=${tenant.slug}, code=${code})`);

    // ponytail: Order has no tenantId; scope via Branch.tenantId.
    const branches = await prisma.branch.findMany({
      where: { tenantId: tenant.id },
      select: { id: true },
    });
    const branchIds = branches.map((b) => b.id);
    if (branchIds.length === 0) continue;

    const orders = await prisma.order.findMany({
      where: { branchId: { in: branchIds } },
      select: { id: true, orderNumber: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });

    // Group by date extracted from orderNumber (only those still in ORD-* format)
    const byDate = new Map<string, typeof orders>();
    for (const o of orders) {
      const match = o.orderNumber?.match(ORD_RE);
      if (!match) {
        // Already renumbered (or malformed) — skip
        totalSkipped++;
        continue;
      }
      const dateStr = match[1];
      if (!byDate.has(dateStr)) byDate.set(dateStr, []);
      byDate.get(dateStr)!.push(o);
    }

    for (const [dateStr, dayOrders] of byDate) {
      // dayOrders is already sorted by createdAt (from findMany orderBy)
      const prefix = `${code}-${dateStr}-`;
      // ponytail: start from max existing sequence under this prefix so we
      // don't collide with CODE-* orders already backfilled for this date.
      // String ordering of orderNumber matches numeric ordering within a
      // fixed prefix (zero-padded), so orderBy desc gives the true max.
      const latest = await prisma.order.findFirst({
        where: { orderNumber: { startsWith: prefix } },
        orderBy: { orderNumber: "desc" },
      });
      let seq = latest ? parseSequence(latest.orderNumber ?? "0") : 0;
      const startSeq = seq + 1;
      for (const o of dayOrders) {
        seq++;
        const newNumber = `${prefix}${String(seq).padStart(4, "0")}`;
        await prisma.order.update({
          where: { id: o.id },
          data: { orderNumber: newNumber },
        });
        totalRenumbered++;
      }
      console.log(
        `    ${dateStr}: ${dayOrders.length} order(s) → ${prefix}${String(startSeq).padStart(4, "0")}..${prefix}${String(seq).padStart(4, "0")}`,
      );
    }
  }

  console.log(`\n✅ Renumbered ${totalRenumbered} order(s). Skipped ${totalSkipped}.`);
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
