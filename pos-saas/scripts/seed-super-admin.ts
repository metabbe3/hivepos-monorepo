/**
 * Idempotent bootstrap for the first SuperAdmin row.
 * Run with: npx tsx scripts/seed-super-admin.ts
 *
 * Env:
 *   SUPER_ADMIN_EMAIL     (default: super-admin@hivepos.id)
 *   SUPER_ADMIN_PASSWORD  (REQUIRED — no default, fails loudly if missing)
 *   SUPER_ADMIN_NAME      (default: "Platform Admin")
 *
 * SQL escape hatch if locked out:
 *   psql -c "UPDATE \"SuperAdmin\" SET \"passwordHash\" = '\$2b\$12\$...' WHERE email = '...'"
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import bcrypt from "bcrypt";
import "dotenv/config";

const email = process.env.SUPER_ADMIN_EMAIL ?? "super-admin@hivepos.id";
const password = process.env.SUPER_ADMIN_PASSWORD;
const name = process.env.SUPER_ADMIN_NAME ?? "Platform Admin";

if (!password) {
  console.error("❌ SUPER_ADMIN_PASSWORD env var is required.");
  console.error("   SUPER_ADMIN_EMAIL and SUPER_ADMIN_NAME are optional.");
  process.exit(1);
}

const VALIDATED_PASSWORD: string = password;

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash(VALIDATED_PASSWORD, 12);

  const admin = await prisma.superAdmin.upsert({
    where: { email },
    update: { passwordHash }, // rotate password on re-run
    create: { email, name, passwordHash, role: "SUPER_ADMIN" },
  });

  console.log(`✅ SuperAdmin upserted:`);
  console.log(`   id    : ${admin.id}`);
  console.log(`   email : ${admin.email}`);
  console.log(`   name  : ${admin.name}`);
  console.log(`   role  : ${admin.role}`);
  console.log(`\nLogin at /super-admin/login`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
