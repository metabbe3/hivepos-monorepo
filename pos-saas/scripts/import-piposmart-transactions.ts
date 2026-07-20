// One-off: import piposmart_penjualan.csv → Honey Bee Laundry orders.
// 128 rows (Jul 10-13, 2026, original dates kept). Each row → Order + OrderItem(s)
// + Payment (if paid). Customer matched by phone (created if missing). Service
// line-items matched (normalized) to the restored backup catalog; unmatched →
// Lain-Lain. Garment note → OrderItem.garmentBreakdown [{name,qty}] (rincian
// pakaian). Idempotent via Order.clientId = "piposmart-<transaction_id>".
import { readFileSync } from "node:fs";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { parseCSV } from "../lib/csv";

const BRANCH_ID = "1f11058d-b9bd-4498-95bb-d4f52af3673f";
const CSV_PATH = "/Users/nicholasandriansurjadi/Documents/piposmart_penjualan.csv";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const STATUS_MAP: Record<string, "RECEIVED" | "IN_PROGRESS" | "READY" | "DELIVERED"> = {
  Diterima: "RECEIVED",
  Diproses: "IN_PROGRESS",
  "Siap diambil": "READY",
  Selesai: "DELIVERED",
};

function normPhone(raw: string): string | null {
  let p = (raw ?? "").trim().replace(/[\s-]/g, "");
  if (p.startsWith("+62")) p = "0" + p.slice(3);
  return p === "" ? null : p;
}
function parseRupiah(s: string): number | null {
  const m = (s ?? "").replace(/[^\d]/g, "");
  return m === "" ? null : Number(m);
}
// "Jumat, 17-07-2026 21:46" → Date (DD-MM-YYYY HH:MM)
function parseDateIndo(s: string): Date | null {
  const m = (s ?? "").match(/(\d{1,2})-(\d{1,2})-(\d{4})\s+(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}
// Normalize a service token for matching against the restored catalog.
function normService(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\s*\/\s*/g, " ")
    .replace(/\bkg\b/g, " ")
    .replace(/\bbuah\b/g, " ")
    .replace(/\bpromo\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
// Parse the garment note → [{name,qty}] for OrderItem.garmentBreakdown.
function parseGarments(note: string): Array<{ name: string; qty: number }> {
  if (!note || note === "-" ) return [];
  return note
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const m = part.match(/^(.*?)\s+(\d+)\s*\D*$/);
      if (m) return { name: m[1].trim(), qty: Number(m[2]) };
      return { name: part, qty: 0 };
    })
    .filter((g) => g.name.length > 0);
}
// Parse "Token (qty Unit) @ Rp. price" → { token, qty, unit, price }
function parseItem(raw: string): { token: string; qty: number; unit: string; price: number } | null {
  const at = raw.split("@");
  const left = at[0]?.trim() ?? "";
  const price = parseRupiah(at.slice(1).join("@"));
  const qm = left.match(/^(.*?)\s*\(([\d.]+)\s*([A-Za-z]+)\)\s*$/);
  let token = left;
  let qty = 1;
  let unit = "";
  if (qm) {
    token = qm[1].trim();
    qty = Number(qm[2]);
    unit = qm[3];
  }
  token = token.replace(/\s+(kg|buah)$/i, "").trim();
  if (!token) return null;
  if (price == null && qty == null) return null;
  return { token, qty: qty || 1, unit, price: price ?? 0 };
}

async function main() {
  const text = readFileSync(CSV_PATH, "utf8").replace(/^﻿/, "");
  const rows = parseCSV(text);
  const header = rows[0].map((h) => h.trim());
  const col = (n: string) => header.indexOf(n);

  // --- Load service catalog: normName → serviceId (+ Lain-Lain id) ---
  const services = await prisma.service.findMany({
    where: { branchId: BRANCH_ID },
    select: { id: true, name: true },
  });
  const svcByNorm = new Map<string, string>();
  let lainId = "";
  for (const s of services) {
    if (s.name.trim().toLowerCase() === "lain-lain") lainId = s.id;
    svcByNorm.set(normService(s.name), s.id);
  }
  if (!lainId) throw new Error("Lain-Lain service missing — run restore-honeybee-services first");

  // --- Load customers: normPhone → id, lowerName → id ---
  const customers = await prisma.customer.findMany({
    where: { branchId: BRANCH_ID },
    select: { id: true, name: true, phone: true },
  });
  const custByPhone = new Map<string, string>();
  const custByName = new Map<string, string>();
  for (const c of customers) {
    if (c.phone) custByPhone.set(normPhone(c.phone) ?? "", c.id);
    custByName.set(c.name.trim().toLowerCase(), c.id);
  }

  // --- Idempotency: existing Order.clientId for this branch ---
  const existing = new Set(
    (
      await prisma.order.findMany({
        where: { branchId: BRANCH_ID, clientId: { startsWith: "piposmart-" } },
        select: { clientId: true },
      })
    ).map((o) => o.clientId ?? ""),
  );

  let total = 0;
  let inserted = 0;
  let skippedExisting = 0;
  let itemsMatched = 0;
  let itemsLain = 0;
  let custMatched = 0;
  let custCreated = 0;
  let paymentsCreated = 0;
  let seq = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    total++;
    const txId = r[col("transaction_id")]?.trim();
    const clientId = `piposmart-${txId}`;
    if (!txId || existing.has(clientId)) {
      skippedExisting++;
      continue;
    }

    const custName = r[col("customer_name")]?.trim() || "Pelanggan";
    const phone = normPhone(r[col("customer_phone")] ?? "");
    const status = STATUS_MAP[r[col("status")]?.trim()] ?? "RECEIVED";
    const payRaw = r[col("payment_status")]?.trim();
    const paymentStatus = payRaw === "Lunas" ? "PAID" : "PENDING";
    const totalAmount = parseRupiah(r[col("total")] ?? "") ?? 0;
    const amountPaid = parseRupiah(r[col("amount_paid")] ?? "");
    const receivedAt = parseDateIndo(r[col("date_received")] ?? "");
    const estPickup = parseDateIndo(r[col("est_pickup")] ?? "");
    const note = r[col("note")]?.trim();
    const itemsStr = r[col("items")] ?? "";

    // --- Match / create customer ---
    let customerId = phone ? custByPhone.get(phone) : undefined;
    if (!customerId) customerId = custByName.get(custName.toLowerCase());
    if (!customerId) {
      const c = await prisma.customer.create({
        data: { name: custName, phone, branchId: BRANCH_ID },
        select: { id: true },
      });
      customerId = c.id;
      if (phone) custByPhone.set(phone, c.id);
      custByName.set(custName.toLowerCase(), c.id);
      custCreated++;
    } else {
      custMatched++;
    }

    // --- Parse line items ---
    const garments = parseGarments(note ?? "");
    const parsedItems = itemsStr
      .split(/\s*;\s*/)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(parseItem)
      .filter((x): x is NonNullable<typeof x> => x !== null);

    const orderItems = (parsedItems.length ? parsedItems : [{ token: "Lain-Lain", qty: 1, unit: "", price: totalAmount }]).map(
      (it) => {
        const svcId = svcByNorm.get(normService(it.token)) ?? lainId;
        if (svcId === lainId) itemsLain++;
        else itemsMatched++;
        return {
          serviceId: svcId,
          quantity: it.qty,
          weightKg: it.unit.toLowerCase() === "kg" ? it.qty : null,
          pricePerUnit: it.qty > 0 ? Math.round((it.price / it.qty) * 100) / 100 : it.price,
          subtotal: it.price,
          garmentBreakdown: garments.length > 0 ? garments : undefined,
        };
      },
    );

    // --- Timestamps by status ---
    const inProgressAt = status === "RECEIVED" ? null : receivedAt ? new Date(receivedAt.getTime() + 3600_000) : null;
    const readyAt = status === "IN_PROGRESS" || status === "RECEIVED" ? null : inProgressAt;
    const deliveredAt = status === "DELIVERED" ? (estPickup ?? receivedAt) : null;

    const order = await prisma.order.create({
      data: {
        orderNumber: `HB-${(++seq).toString().padStart(4, "0")}-${txId.replace(/[^\w]/g, "-")}`.slice(0, 40),
        customerId,
        status,
        totalAmount,
        paidAmount: paymentStatus === "PAID" ? (amountPaid ?? totalAmount) : 0,
        paymentStatus,
        module: "LAUNDRY",
        branchId: BRANCH_ID,
        clientId,
        notes: note && note !== "-" ? note : null,
        createdAt: receivedAt ?? new Date(),
        updatedAt: deliveredAt ?? receivedAt ?? new Date(),
        receivedAt,
        inProgressAt,
        readyAt,
        deliveredAt,
        orderItems: { create: orderItems },
      },
    });

    // --- Payment (if paid) ---
    if (paymentStatus === "PAID") {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: amountPaid ?? totalAmount,
          paymentMethod: "CASH",
          paidAt: parseDateIndo(r[col("payment_date")] ?? "") ?? receivedAt ?? new Date(),
        },
      });
      paymentsCreated++;
    }

    existing.add(clientId);
    inserted++;
  }

  console.log("piposmart transaction import → Honey Bee Laundry");
  console.log("  branchId:", BRANCH_ID);
  console.log("  CSV rows:", total);
  console.log("  orders inserted:", inserted);
  console.log("  skipped existing (re-run):", skippedExisting);
  console.log("  order items matched to service:", itemsMatched);
  console.log("  order items → Lain-Lain:", itemsLain);
  console.log("  customers matched:", custMatched);
  console.log("  customers created:", custCreated);
  console.log("  payments created:", paymentsCreated);
}

main()
  .catch((e) => {
    console.error("❌ import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
