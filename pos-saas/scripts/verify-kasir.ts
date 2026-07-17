// One-off verify helper: confirms Honey Bee's Kasir role has services:read
// (the bug fix), and creates a throwaway Kasir user on the demo tenant so we
// can log in + test the order-create flow end-to-end.
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Honey Bee Kasir perms (root-cause confirmation).
  const honeybee = await prisma.tenant.findFirst({ where: { name: { contains: "Honey Bee" } } });
  if (honeybee) {
    const kasir = await prisma.role.findFirst({ where: { tenantId: honeybee.id, name: "Kasir" } });
    console.log("Honey Bee Kasir has services:read?", (kasir?.permissions as string[])?.includes("services:read"));
  } else {
    console.log("(Honey Bee tenant not found)");
  }

  // 2. Create a Kasir test user on the demo tenant.
  const demo = await prisma.tenant.findFirst({
    where: { slug: "demo-laundry" },
    include: { branches: { take: 1 } },
  });
  if (!demo || !demo.branches[0]) throw new Error("demo tenant/branch missing");
  const kasirRole = await prisma.role.findFirst({ where: { tenantId: demo.id, name: "Kasir" } });
  if (!kasirRole) throw new Error("demo Kasir role missing");

  const email = "kasir-verify@demo.local";
  await prisma.user.deleteMany({ where: { email } });
  const hash = await bcrypt.hash("kasir123", 12);
  await prisma.user.create({
    data: {
      email,
      passwordHash: hash,
      name: "Kasir Verify",
      role: "EMPLOYEE",
      tenantId: demo.id,
      branchId: demo.branches[0].id,
      roleId: kasirRole.id,
    },
  });
  console.log("Kasir test user ready:", email, "/ kasir123 (demo tenant)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); await pool.end(); });
