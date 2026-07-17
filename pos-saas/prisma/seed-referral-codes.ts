import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { generateUniqueReferralCode } from "../lib/referrals";

// Backfill: give every existing tenant a unique referralCode.
// Idempotent — skips tenants that already have one. Run after the schema change:
//   npx tsx prisma/seed-referral-codes.ts

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { referralCode: null },
    select: { id: true, name: true },
  });
  console.log(`🎟  Backfilling referral codes for ${tenants.length} tenants...`);
  let done = 0;
  for (const t of tenants) {
    const code = await generateUniqueReferralCode();
    try {
      await prisma.tenant.update({ where: { id: t.id }, data: { referralCode: code } });
      done++;
    } catch {
      // rare collision on concurrent run — skip; re-run picks it up
    }
  }
  console.log(`Done. ${done}/${tenants.length} codes assigned.`);
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
