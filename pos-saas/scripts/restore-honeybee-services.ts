// One-off: restore the real service catalog for Honey Bee Laundry from the
// Jun-2 MariaDB backup (same business). Skips backup id/branchId/groupId/
// timestamps; remaps branchId to Honey Bee. Idempotent (skips names already in
// the branch). Ensures a "Lain-Lain" catch-all exists for unmatched import items.
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { PrismaClient, type Prisma } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const BRANCH_ID = "1f11058d-b9bd-4498-95bb-d4f52af3673f"; // Honey Bee Laundry branch
const BACKUP_GZ =
  "/Users/nicholasandriansurjadi/Documents/laundry-webapp/data/backups/laundry_db_2026-06-02_020001.sql.gz";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Extract service tuples from the MariaDB dump. Tuple fields (positional):
// (id, name, description, pricingType, basePrice, commissionType, commissionValue,
//  isActive, branchId, createdAt, updatedAt, groupId) — capture name, pricingType,
// basePrice, commissionType, commissionValue, isActive.
const TUPLE_RE =
  /\(\s*'[^']*'\s*,\s*'([^']*)'\s*,\s*(?:NULL|'[^']*')\s*,\s*'(PER_KG|PER_ITEM)'\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*'(NONE|FLAT|PERCENTAGE)'\s*,\s*([0-9]+(?:\.[0-9]+)?)\s*,\s*([01])/g;

function extractServices(sql: string) {
  // Only look within the service INSERT block (avoid matching other tables).
  const blockStart = sql.indexOf("INSERT INTO `service`");
  const blockEnd = sql.indexOf(";", blockStart);
  const block = sql.slice(blockStart, blockEnd === -1 ? undefined : blockEnd);
  const out: Array<{
    name: string;
    pricingType: "PER_KG" | "PER_ITEM";
    basePrice: number;
    commissionType: "NONE" | "FLAT" | "PERCENTAGE";
    commissionValue: number;
    isActive: boolean;
  }> = [];
  for (const m of block.matchAll(TUPLE_RE)) {
    out.push({
      name: m[1].trim(),
      pricingType: m[2] as "PER_KG" | "PER_ITEM",
      basePrice: Number(m[3]),
      commissionType: m[4] as "NONE" | "FLAT" | "PERCENTAGE",
      commissionValue: Number(m[5]),
      isActive: m[6] === "1",
    });
  }
  return out;
}

async function main() {
  const gz = readFileSync(BACKUP_GZ);
  const sql = gunzipSync(gz).toString("utf8");
  const services = extractServices(sql);
  console.log(`backup services extracted: ${services.length}`);

  const existing = new Set(
    (
      await prisma.service.findMany({
        where: { branchId: BRANCH_ID },
        select: { name: true },
      })
    ).map((s) => s.name.trim().toLowerCase()),
  );

  const toCreate: Prisma.ServiceCreateManyInput[] = [];
  let skippedDup = 0;
  const seen = new Set<string>();
  for (const s of services) {
    const key = s.name.toLowerCase();
    if (!s.name || seen.has(key) || existing.has(key)) {
      skippedDup++;
      continue;
    }
    seen.add(key);
    toCreate.push({
      name: s.name,
      pricingType: s.pricingType,
      basePrice: s.basePrice,
      commissionType: s.commissionType,
      commissionValue: s.commissionValue,
      isActive: s.isActive,
      module: "LAUNDRY",
      branchId: BRANCH_ID,
      isDefaultSpeed: false,
    });
  }

  let inserted = 0;
  if (toCreate.length) {
    const res = await prisma.service.createMany({ data: toCreate, skipDuplicates: true });
    inserted = res.count;
  }

  // Ensure Lain-Lain catch-all exists.
  const LAIN = "Lain-Lain";
  let lainlain = await prisma.service.findFirst({
    where: { branchId: BRANCH_ID, name: { equals: LAIN, mode: "insensitive" } },
    select: { id: true },
  });
  if (!lainlain) {
    lainlain = await prisma.service.create({
      data: {
        name: LAIN,
        pricingType: "PER_ITEM",
        basePrice: 0,
        module: "LAUNDRY",
        branchId: BRANCH_ID,
        isDefaultSpeed: false,
      },
      select: { id: true },
    });
    console.log(`created catch-all service "${LAIN}" (${lainlain.id})`);
  }

  console.log("honey-bee service restore");
  console.log("  branchId:", BRANCH_ID);
  console.log("  backup services:", services.length);
  console.log("  inserted:", inserted);
  console.log("  skipped dup (already in branch / repeat):", skippedDup);
  console.log("  Lain-Lain id:", lainlain.id);
}

main()
  .catch((e) => {
    console.error("❌ restore failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
