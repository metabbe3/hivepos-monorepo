// One-off: import piposmart_pelanggan.csv → Honey Bee Laundry customers.
// Skip CSV `id` (we generate UUIDs) + `transaksi` (transactions). Save email +
// address (address → notes; no address column on Customer). Phone normalized
// (+62→0) + deduped so re-runs are idempotent. Reuses seed-demo-data.ts
// connection boilerplate + lib/csv.ts parser.
import { readFileSync } from "node:fs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { parseCSV } from "../lib/csv";

const BRANCH_ID = "1f11058d-b9bd-4498-95bb-d4f52af3673f"; // Honey Bee Laundry branch
const CSV_PATH = "/Users/nicholasandriansurjadi/Documents/piposmart_pelanggan.csv";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// +62… → 0…; trim spaces/dashes. Empty → null (null phones coexist under the
// @@unique([branchId, phone]) constraint; "" would collide).
function normPhone(raw: string): string | null {
  let p = (raw ?? "").trim().replace(/[\s-]/g, "");
  if (p.startsWith("+62")) p = "0" + p.slice(3);
  return p === "" ? null : p;
}
function clean(v: string | undefined): string | null {
  const s = (v ?? "").trim();
  return s === "" ? null : s;
}

async function main() {
  // strip leading UTF-8 BOM if present (file starts with U+FEFF)
  const text = readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "");
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("empty CSV");
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const cName = col("name");
  const cPhone = col("phone");
  const cEmail = col("email");
  const cAddr = col("address");
  if (cName < 0) throw new Error(`no 'name' column; header: ${header.join(", ")}`);

  // Idempotency: existing non-null phones in the branch → skip on re-run.
  const existing = new Set<string>();
  const exRows = await prisma.$queryRaw<Array<{ phone: string | null }>>`
    SELECT phone FROM "Customer" WHERE "branchId" = ${BRANCH_ID} AND phone IS NOT NULL`;
  for (const r of exRows) if (r.phone) existing.add(r.phone);

  let total = 0;
  let skipDupCsv = 0;
  let skipExisting = 0;
  let skipNoName = 0;
  let noPhone = 0;
  const seenPhone = new Set<string>();
  const toCreate: Array<{
    name: string;
    phone: string | null;
    email: string | null;
    notes: string | null;
    branchId: string;
  }> = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    total++;
    const name = (r[cName] ?? "").trim();
    if (name === "") {
      skipNoName++;
      continue;
    }
    const phone = normPhone(r[cPhone] ?? "");
    const email = clean(r[cEmail]);
    const notes = clean(r[cAddr]);
    if (phone === null) noPhone++;
    if (phone) {
      if (seenPhone.has(phone)) {
        skipDupCsv++;
        continue;
      }
      if (existing.has(phone)) {
        skipExisting++;
        continue;
      }
      seenPhone.add(phone);
    }
    toCreate.push({ name, phone, email, notes, branchId: BRANCH_ID });
  }

  let inserted = 0;
  if (toCreate.length) {
    const res = await prisma.customer.createMany({ data: toCreate, skipDuplicates: true });
    inserted = res.count;
  }

  console.log("piposmart customer import → Honey Bee Laundry");
  console.log("  branchId:", BRANCH_ID);
  console.log("  CSV data rows:", total);
  console.log("  inserted:", inserted);
  console.log("  skipped dup-in-CSV:", skipDupCsv);
  console.log("  skipped existing-in-branch:", skipExisting);
  console.log("  skipped no-name:", skipNoName);
  console.log("  rows without phone (imported anyway):", noPhone);
}

main()
  .catch((e) => {
    console.error("❌ import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
