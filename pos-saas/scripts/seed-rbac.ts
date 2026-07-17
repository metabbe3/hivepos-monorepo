/**
 * Backfill script: seed the 4 default system roles for every existing tenant
 * and link all users to the appropriate Role row (migrating off the legacy
 * UserRole enum).
 *
 * Usage:  npx tsx scripts/seed-rbac.ts
 *
 * Safe to run multiple times — it's idempotent.
 */

import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { seedDefaultRoles, backfillUserRoles } from "../lib/permissions/seed";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding RBAC roles for all tenants...");

  const tenants = await prisma.tenant.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });

  let totalRoles = 0;
  let totalUsers = 0;

  for (const t of tenants) {
    const roleMap = await seedDefaultRoles(prisma, t.id);
    const updated = await backfillUserRoles(prisma, t.id, roleMap);
    totalRoles += Object.keys(roleMap).length;
    totalUsers += updated;
    console.log(
      `  ✅ ${t.name}: ${Object.keys(roleMap).length} roles, ${updated} users linked`,
    );
  }

  console.log(
    `\n✅ RBAC seed complete! ${totalRoles} roles across ${tenants.length} tenants, ${totalUsers} users linked.`,
  );
}

main()
  .catch((e) => {
    console.error("❌ RBAC seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
