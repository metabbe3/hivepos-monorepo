import type { Prisma } from "@/lib/prisma";
import type { PrismaClient } from "@/app/generated/prisma/client";

// Sandbox demo seed — creates realistic-but-fake data on a fresh demo branch so
// the dashboard (stats, heatmap, pipeline, piutang, top customers, service mix)
// looks alive the moment a visitor lands. Bounded (~30 customers, 7 services,
// 60 orders) — paired with the 5/hr/IP rate-limit + lazy cleanup in
// app/api/demo/start. ponytail: direct prisma writes (no service layer) — this
// is seed data, not user input, and runs inside the provision transaction.

type Tx = Prisma.TransactionClient;

const FIRST = ["Budi", "Sari", "Andi", "Dewi", "Rian", "Maya", "Joko", "Rina", "Agus", "Lina", "Bayu", "Tari", "Eko", "Wati", "Fajar", "Nur", "Hadi", "Yuni", "Rama", "Intan", "Dian", "Putri", "Andra", "Sinta", "Galih", "Kartika", "Yoga", "Melati", "Rudi", "Sri"];
const LAST = ["Santoso", "Wijaya", "Pratama", "Lestari", "Saputra", "Hidayat", "Maharani", "Kusuma", "Nugroho", "Anggraini", "Setiawan", "Permana", "Utami", "Halim", "Wibowo"];

const SERVICE_DEFS = [
  { name: "Cuci Kering", pricingType: "PER_KG" as const, basePrice: 7000 },
  { name: "Cuci Setrika", pricingType: "PER_KG" as const, basePrice: 10000 },
  // A speed-variant group to showcase the inline speed pills + default flag.
  { name: "Setrika Kilat Reguler", pricingType: "PER_KG" as const, basePrice: 9000, isDefaultSpeed: true },
  { name: "Setrika Kilat Express 24 Jam", pricingType: "PER_KG" as const, basePrice: 14000 },
  { name: "Cuci Sepatu", pricingType: "PER_ITEM" as const, basePrice: 25000 },
  { name: "Cuci Bedcover", pricingType: "PER_ITEM" as const, basePrice: 30000 },
  { name: "Cuci Boneka", pricingType: "PER_ITEM" as const, basePrice: 20000 },
];

const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

export async function seedSandbox(tx: Tx, branchId: string): Promise<void> {
  // 1. Services (created individually so we keep their ids for order items).
  // ponytail: carry basePrice as a plain number — prisma returns Decimal, which
  // breaks the arithmetic below; the def's number is what we need anyway.
  const services = await Promise.all(
    SERVICE_DEFS.map(async (s) => {
      const rec = await tx.service.create({
        data: {
          name: s.name,
          pricingType: s.pricingType,
          basePrice: s.basePrice,
          module: "LAUNDRY",
          isActive: true,
          isDefaultSpeed: s.isDefaultSpeed ?? false,
          commissionType: "NONE",
          commissionValue: 0,
          branchId,
        },
      });
      return { id: rec.id, pricingType: s.pricingType, basePrice: s.basePrice };
    }),
  );

  // 2. Customers (createMany, then read back ids).
  const customers = Array.from({ length: 30 }, (_, i) => ({
    name: `${pick(FIRST)} ${pick(LAST)}`,
    phone: `08${rand(11, 21)}${String(rand(0, 99999999)).padStart(8, "0")}`.slice(0, 13) + i, // unique-ish suffix
    branchId,
  }));
  await tx.customer.createMany({ data: customers });
  const customerIds = (await tx.customer.findMany({ where: { branchId }, select: { id: true } })).map((c) => c.id);

  // 3. Orders (60) spread over the last 30 days, varied status + payment.
  const now = Date.now();
  const DAY = 86_400_000;
  const branch = branchId.slice(0, 4);
  // Weighted status: mostly progressed, some in pipeline.
  const statusFor = (r: number) =>
    r < 0.35 ? "DELIVERED" : r < 0.6 ? "READY" : r < 0.85 ? "IN_PROGRESS" : "RECEIVED";

  for (let i = 0; i < 60; i++) {
    const svc = pick(services);
    const isKg = svc.pricingType === "PER_KG";
    const qty = isKg ? 1 : rand(1, 4);
    const weight = isKg ? Math.round((rand(15, 65) / 10) * 100) / 100 : null; // 1.5–6.5 kg
    const units = isKg ? weight! : qty;
    const subtotal = Math.round(svc.basePrice * units);
    // ~1/3 of orders add a second line.
    const second = Math.random() < 0.33 ? pick(services.filter((s) => s.id !== svc.id)) : null;
    let total = subtotal;
    const items: { serviceId: string; quantity: number; weightKg: number | null; pricePerUnit: number; subtotal: number }[] = [
      { serviceId: svc.id, quantity: qty, weightKg: weight, pricePerUnit: svc.basePrice, subtotal },
    ];
    if (second) {
      const sKg = second.pricingType === "PER_KG";
      const sQty = sKg ? 1 : rand(1, 3);
      const sW = sKg ? Math.round((rand(15, 55) / 10) * 100) / 100 : null;
      const sSub = Math.round(second.basePrice * (sKg ? sW! : sQty));
      items.push({ serviceId: second.id, quantity: sQty, weightKg: sW, pricePerUnit: second.basePrice, subtotal: sSub });
      total += sSub;
    }

    const status = statusFor(Math.random());
    const payRoll = Math.random();
    const paymentStatus = payRoll < 0.7 ? "PAID" : payRoll < 0.85 ? "PARTIAL" : "PENDING";
    const paidAmount = paymentStatus === "PAID" ? total : paymentStatus === "PARTIAL" ? Math.floor(total / 2) : 0;

    const created = new Date(now - rand(0, 30) * DAY - rand(0, DAY));
    const orderNumber = `D${branch}${(now % 1_000_000).toString(36)}${i}`;

    await tx.order.create({
      data: {
        orderNumber,
        customerId: pick(customerIds),
        status,
        totalAmount: total,
        paidAmount,
        paymentStatus,
        module: "LAUNDRY",
        branchId,
        createdAt: created,
        receivedAt: created,
        inProgressAt: status === "IN_PROGRESS" || status === "READY" || status === "DELIVERED" ? new Date(created.getTime() + 2 * 3600_000) : null,
        readyAt: status === "READY" || status === "DELIVERED" ? new Date(created.getTime() + 10 * 3600_000) : null,
        deliveredAt: status === "DELIVERED" ? new Date(created.getTime() + 24 * 3600_000) : null,
        orderItems: { create: items },
      },
    });
  }
}

// Kept for type reuse / future admin "reset demo" tooling.
export type { PrismaClient };
