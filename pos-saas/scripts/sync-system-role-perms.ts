// Backfill: additively sync existing system roles to the current DEFAULT_ROLES
// permissions. seedDefaultRoles (lib/permissions/seed.ts) is create-only for
// non-Owner roles, so changing DEFAULT_ROLES alone doesn't reach existing
// tenants. This script UNIONS each default role's permissions into the existing
// role of the same name — adds missing perms (e.g. services:read to Kasir/Staff)
// WITHOUT removing owner customizations or extra perms. Idempotent. Owner is
// skipped (always wildcard-pinned by seedDefaultRoles).
//
//   npx tsx scripts/sync-system-role-perms.ts
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { DEFAULT_ROLES } from "../lib/permissions/defaults";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🔁 Additively syncing system role permissions…");
  const tenants = await prisma.tenant.findMany({ select: { id: true, name: true } });
  let changed = 0;

  for (const t of tenants) {
    for (const def of DEFAULT_ROLES) {
      if (def.name === "Owner") continue; // wildcard-pinned elsewhere
      const role = await prisma.role.findFirst({
        where: { tenantId: t.id, name: def.name },
        select: { id: true, permissions: true },
      });
      if (!role) continue; // missing role — run seed-rbac first

      const current = new Set<string>((role.permissions as string[]) ?? []);
      const before = current.size;
      for (const p of def.permissions as string[]) current.add(p); // union, additive only
      if (current.size === before) continue;

      await prisma.role.update({
        where: { id: role.id },
        data: { permissions: [...current] },
      });
      changed++;
      console.log(`  ✓ ${t.name} / ${def.name}: +${current.size - before} perm(s)`);
    }
  }

  console.log(`Done. ${changed} role(s) updated across ${tenants.length} tenant(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
