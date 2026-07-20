// ponytail: throwaway demo data — populates the demo tenant with realistic
// orders/payments/stock so the hivepos dashboard renders every card for a
// flagship polish pass. Not real data; safe to drop. Run once after seed.ts.
// Upgrade path: replace with the MariaDB→PG migration of the Jun-2 backup
// (1028 real orders) when that migration is built.
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const NAMES = [
  "Budi Santoso", "Siti Rahayu", "Agus Wijaya", "Dewi Lestari", "Rudi Hartono",
  "Maya Putri", "Joko Susilo", "Rina Marlina", "Andi Pratama", "Fitri Handayani",
  "Eko Nugroho", "Wati Suryani", "Hadi Kusuma", "Lia Anggraini", "Bambang Sutrisno",
  "Yuni Astuti", "Dian Permata", "Rizki Ramadhan", "Nur Aini", "Toni Gunawan",
  "Sri Wahyuni", "Fajar Nur", "Indah Permatasari", "Yusuf Maulana", "Ayu Saraswati",
  "Hendra Wijaya", "Mega Kusuma", "Ari Wibowo", "Putri Maharani", "Doni Saputra",
  "Kartika Sari", "Reza Firmansyah", "Lina Marlina", "Gilang Akbar", "Tuti Alawiyah",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randDays(max: number) {
  return Math.floor(Math.random() * max);
}
function randHours(max: number) {
  return Math.floor(Math.random() * max);
}

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: "demo-laundry" } });
  if (!tenant) throw new Error("demo-laundry tenant missing — run seed.ts first");
  const branch = await prisma.branch.findFirst({ where: { tenantId: tenant.id } });
  if (!branch) throw new Error("branch missing");
  const services = await prisma.service.findMany({ where: { branchId: branch.id, isActive: true } });
  if (!services.length) throw new Error("no services — run seed.ts first");

  // Existing data? Skip to stay idempotent.
  const existing = await prisma.customer.count({ where: { branchId: branch.id } });
  if (existing > 0) {
    console.log(`⏭️  ${existing} customers already exist — skipping demo data.`);
    return;
  }

  console.log("🌱 Seeding demo orders/payments/stock...");

  // ── Customers ──
  const customers = await Promise.all(
    NAMES.map((name, i) =>
      prisma.customer.create({
        data: {
          name,
          phone: `0812${String(34560000 + i * 137).padStart(8, "0")}`,
          email: i % 3 === 0 ? `cust${i}@mail.com` : null,
          branchId: branch.id,
          createdAt: new Date(Date.now() - randDays(40) * 864e5),
        },
      })
    )
  );
  console.log(`  ✅ ${customers.length} customers`);

  // ── Stock items (1 low, 1 healthy) ──
  await prisma.stockItem.createMany({
    data: [
      { name: "Deterjen", unit: "kg", currentQuantity: 1.5, lowStockThreshold: 5, purchasePricePerUnit: 12000, branchId: branch.id },
      { name: "Pewangi", unit: "liter", currentQuantity: 18, lowStockThreshold: 3, purchasePricePerUnit: 25000, branchId: branch.id },
      { name: "Plastik Cuci", unit: "pcs", currentQuantity: 0.5, lowStockThreshold: 20, purchasePricePerUnit: 500, branchId: branch.id },
    ],
  });
  console.log(`  ✅ 3 stock items (2 low-stock)`);

  // ── Orders across last 35 days ──
  const STATUSES = ["DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "DELIVERED", "READY", "READY", "IN_PROGRESS", "IN_PROGRESS", "RECEIVED"] as const;
  const PAY_METHODS = ["CASH", "CASH", "CASH", "QRIS", "QRIS", "TRANSFER", "DEPOSIT"] as const;
  const ORDER_COUNT = 110;
  const UNPAID_DELIVERED = 6;
  let orderSeq = 1000;

  for (let i = 0; i < ORDER_COUNT; i++) {
    const status = pick(STATUSES as readonly (typeof STATUSES)[number][]);
    const customer = pick(customers);
    const created = new Date(Date.now() - randDays(35) * 864e5 - randHours(24) * 36e5);
    created.setHours(pick([8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19]), pick([0, 15, 30, 45]), 0, 0);

    // 1–2 items
    const itemCount = Math.random() < 0.7 ? 1 : 2;
    const chosen = new Set<number>();
    while (chosen.size < itemCount) chosen.add(Math.floor(Math.random() * services.length));
    const items = [...chosen].map((idx) => {
      const svc = services[idx];
      const isKg = svc.pricingType === "PER_KG";
      const qty = isKg ? Math.round((2 + Math.random() * 6) * 10) / 10 : 1 + Math.floor(Math.random() * 4);
      const pricePerUnit = Number(svc.basePrice);
      const subtotal = Math.round(pricePerUnit * Number(qty) * 100) / 100;
      return { svc, quantity: qty, weightKg: isKg ? qty : null, pricePerUnit, subtotal };
    });
    const totalAmount = items.reduce((s, it) => s + it.subtotal, 0);

    // Payment: delivered mostly PAID (UNPAID_DELIVERED left unpaid), others mostly PENDING/part-upfront.
    const isUnpaidDelivered = status === "DELIVERED" && i < UNPAID_DELIVERED;
    let paymentStatus: "PENDING" | "PARTIAL" | "PAID";
    let paidAmount: number;
    if (isUnpaidDelivered) {
      paymentStatus = "PENDING";
      paidAmount = 0;
    } else if (status === "DELIVERED") {
      paymentStatus = "PAID";
      paidAmount = totalAmount;
    } else if (Math.random() < 0.5) {
      paymentStatus = "PARTIAL";
      paidAmount = Math.round(totalAmount / 2);
    } else {
      paymentStatus = "PENDING";
      paidAmount = 0;
    }

    // Stage timestamps (for turnaround + pipeline rendering).
    const receivedAt = created;
    const inProgressAt = status === "RECEIVED" ? null : new Date(created.getTime() + (1 + randHours(4)) * 36e5);
    const readyAt = status === "IN_PROGRESS" || status === "RECEIVED" ? null : new Date((inProgressAt ?? created).getTime() + (3 + randHours(10)) * 36e5);
    const deliveredAt = status === "DELIVERED" ? new Date((readyAt ?? created).getTime() + (2 + randHours(20)) * 36e5) : null;

    const order = await prisma.order.create({
      data: {
        orderNumber: `INV-${++orderSeq}`,
        customerId: customer.id,
        status,
        totalAmount,
        discountAmount: 0,
        paidAmount,
        paymentStatus,
        notes: Math.random() < 0.2 ? "Mohon hati-hati, ada kemeja kerja." : null,
        module: "LAUNDRY",
        branchId: branch.id,
        createdAt: created,
        updatedAt: deliveredAt ?? created,
        receivedAt,
        inProgressAt: inProgressAt ?? undefined,
        readyAt: readyAt ?? undefined,
        deliveredAt: deliveredAt ?? undefined,
        orderItems: {
          create: items.map((it) => ({
            serviceId: it.svc.id,
            quantity: it.quantity,
            weightKg: it.weightKg,
            pricePerUnit: it.pricePerUnit,
            subtotal: it.subtotal,
          })),
        },
      },
    });

    // Payment(s).
    if (paymentStatus === "PAID") {
      await prisma.payment.create({
        data: { orderId: order.id, amount: totalAmount, paymentMethod: pick(PAY_METHODS as readonly (typeof PAY_METHODS)[number][]), paidAt: deliveredAt ?? created },
      });
    } else if (paymentStatus === "PARTIAL") {
      await prisma.payment.create({
        data: { orderId: order.id, amount: paidAmount, paymentMethod: pick(PAY_METHODS as readonly (typeof PAY_METHODS)[number][]), paidAt: created },
      });
    }
  }

  console.log(`  ✅ ${ORDER_COUNT} orders (${UNPAID_DELIVERED} unpaid-delivered) + items + payments`);
  console.log("\n✅ Demo data complete!");
}

main()
  .catch((e) => {
    console.error("❌ Demo seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
