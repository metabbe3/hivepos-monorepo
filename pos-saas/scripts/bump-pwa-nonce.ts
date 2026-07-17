// One-off: rotate the PWA force-update nonce so every installed client detects
// the change on its next poll, nukes its caches + SW, and reloads. Used to push
// hotfixes (here: clearing stale /demo -> /login cached redirects) without
// waiting for users to discover the install is stale. Mirrors
// app/api/super-admin/pwa/force-update/route.ts (which is super-admin-gated).
//
//   npx tsx scripts/bump-pwa-nonce.ts
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { randomUUID } from "crypto";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const before = (
    await prisma.systemSetting.findUnique({ where: { key: "pwa.forceUpdateNonce" } })
  )?.value;
  const nonce = randomUUID();
  await prisma.systemSetting.upsert({
    where: { key: "pwa.forceUpdateNonce" },
    update: { value: nonce },
    create: { key: "pwa.forceUpdateNonce", value: nonce },
  });
  console.log(`pwa.forceUpdateNonce: ${before ?? "(unset)"} -> ${nonce}`);
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
