/**
 * Enable F&B on the demo tenant + seed sample F&B services and a couple of orders.
 * Run with: npx tsx scripts/enable-fnb-demo.ts
 *
 * After running, sign in as owner@demo.com / demo1234 and use the module
 * selector in the sidebar header to switch between Laundry and F&B.
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { deriveTenantCode } from "../lib/tenant-code";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenant = await prisma.tenant.findUnique({
    where: { slug: "demo-laundry" },
    include: { branches: true },
  });
  if (!tenant) {
    console.error("❌ Demo tenant not found. Run `npm run db:seed` first.");
    process.exit(1);
  }
  const branch = tenant.branches[0];
  if (!branch) {
    console.error("❌ Demo tenant has no branches.");
    process.exit(1);
  }

  // 1) Enable F&B module on tenant (idempotent)
  const activeModules = Array.from(new Set([...(tenant.activeModules ?? []), "fnb"]));
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: { activeModules },
  });
  console.log(`✅ Tenant ${tenant.slug} activeModules: ${activeModules.join(", ")}`);

  // 2) Seed F&B services (idempotent by name+branch+module)
  const fnbServices = [
    { name: "Es Kopi Susu", pricingType: "PER_ITEM" as const, basePrice: 18000, branchId: branch.id, module: "FNB" as const },
    { name: "Nasi Goreng Spesial", pricingType: "PER_ITEM" as const, basePrice: 25000, branchId: branch.id, module: "FNB" as const },
    { name: "Mie Goreng", pricingType: "PER_ITEM" as const, basePrice: 22000, branchId: branch.id, module: "FNB" as const },
    { name: "Es Teh Manis", pricingType: "PER_ITEM" as const, basePrice: 8000, branchId: branch.id, module: "FNB" as const },
  ];
  for (const svc of fnbServices) {
    const existing = await prisma.service.findFirst({
      where: { branchId: svc.branchId, name: svc.name, module: "FNB" },
    });
    if (existing) {
      await prisma.service.update({ where: { id: existing.id }, data: { isActive: true, ...svc } });
    } else {
      await prisma.service.create({ data: svc });
    }
  }
  console.log(`✅ Seeded ${fnbServices.length} F&B services`);

  // 3) Make sure a walk-in customer exists for the demo order
  let customer = await prisma.customer.findFirst({
    where: { branchId: branch.id, phone: "00000" },
  });
  if (!customer) {
    customer = await prisma.customer.create({
      data: { name: "Pelanggan F&B", phone: "00000", branchId: branch.id },
    });
  }

  // 4) Seed a couple of F&B orders so the dashboard + orders page aren't empty
  const existingFnbOrders = await prisma.order.count({
    where: { branchId: branch.id, module: "FNB" },
  });
  if (existingFnbOrders === 0) {
    const services = await prisma.service.findMany({
      where: { branchId: branch.id, module: "FNB" },
    });
    const byName = new Map(services.map((s) => [s.name, s]));

    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
    const tenantCode = deriveTenantCode(tenant.slug);
    const prefix = `${tenantCode}-${dateStr}-`;

    // Find current max sequence for this tenant+date (prefix scopes to one tenant)
    const lastOrder = await prisma.order.findFirst({
      where: { orderNumber: { startsWith: prefix } },
      orderBy: { orderNumber: "desc" },
    });
    let seq = lastOrder ? parseInt(lastOrder.orderNumber.slice(-4)) : 0;

    const ordersToCreate = [
      { items: [["Es Kopi Susu", 2], ["Nasi Goreng Spesial", 1]], status: "DELIVERED" as const, paymentStatus: "PAID" as const },
      { items: [["Mie Goreng", 1], ["Es Teh Manis", 2]], status: "RECEIVED" as const, paymentStatus: "PENDING" as const },
    ];

    for (const ord of ordersToCreate) {
      seq += 1;
      const orderNumber = `${prefix}${String(seq).padStart(4, "0")}`;
      const orderItems = ord.items
        .map(([name, qty]) => {
          const svc = byName.get(name as string);
          if (!svc) return null;
          const pricePerUnit = Number(svc.basePrice);
          return {
            serviceId: svc.id,
            quantity: qty as number,
            weightKg: null,
            pricePerUnit,
            subtotal: pricePerUnit * (qty as number),
          };
        })
        .filter((x): x is NonNullable<typeof x> => x !== null);

      const totalAmount = orderItems.reduce((s, i) => s + i.subtotal, 0);
      const receivedAt = new Date();

      await prisma.order.create({
        data: {
          branchId: branch.id,
          module: "FNB",
          orderNumber,
          customerId: customer.id,
          status: ord.status,
          paymentStatus: ord.paymentStatus,
          paidAmount: ord.paymentStatus === "PAID" ? totalAmount : 0,
          totalAmount,
          receivedAt,
          ...(ord.status === "DELIVERED" ? { deliveredAt: receivedAt } : {}),
          orderItems: { create: orderItems },
        },
      });
    }
    console.log(`✅ Seeded ${ordersToCreate.length} sample F&B orders`);
  } else {
    console.log(`⏭️ F&B orders already exist (${existingFnbOrders})`);
  }

  console.log("\n🎉 Done. Switch modules via the sidebar header dropdown.");
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
