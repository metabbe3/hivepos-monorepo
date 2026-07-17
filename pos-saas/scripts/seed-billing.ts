/**
 * Seed billing data: Growth plan + sample promo codes.
 * Run with: npx tsx scripts/seed-billing.ts
 *
 * Creates:
 *   - "Growth" plan (per-outlet pricing, all modules, unlimited everything)
 *   - Sample promo codes: FREEMONTH (1 free month), HEMAT50 (50% off)
 */
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const PRICE_PER_OUTLET = 49000;
const UNLIMITED = 999999;

async function main() {
  console.log("🌱 Seeding billing data...\n");

  // ── Growth Plan ──
  const growthPlan = await prisma.plan.upsert({
    where: { name: "Growth" },
    update: {
      description: "Per-outlet pricing — all modules included",
      maxOutlets: UNLIMITED,
      maxUsers: UNLIMITED,
      maxOrders: UNLIMITED,
      priceMonthly: PRICE_PER_OUTLET,
      modules: ["laundry", "fnb", "salon", "cleaning"],
    },
    create: {
      name: "Growth",
      description: "Per-outlet pricing — all modules included",
      maxOutlets: UNLIMITED,
      maxUsers: UNLIMITED,
      maxOrders: UNLIMITED,
      priceMonthly: PRICE_PER_OUTLET,
      modules: ["laundry", "fnb", "salon", "cleaning"],
      features: { customBranding: true, api: false, whatsapp: true },
    },
  });
  console.log(`  ✅ Plan: ${growthPlan.name} (${formatRupiah(PRICE_PER_OUTLET)}/outlet/bln)`);

  // ── Sample Promo Codes ──
  const promos = [
    {
      code: "FREEMONTH",
      description: "Gratis 1 bulan langganan",
      type: "FREE_MONTH" as const,
      value: 1,
      maxRedemptions: 100,
    },
    {
      code: "HEMAT50",
      description: "Diskon 50% untuk pembayaran pertama",
      type: "DISCOUNT_PERCENT" as const,
      value: 50,
      maxRedemptions: 50,
    },
    {
      code: "HEMAT25K",
      description: "Potongan Rp 25.000",
      type: "DISCOUNT_FIXED" as const,
      value: 25000,
      maxRedemptions: null, // unlimited
    },
  ];

  for (const promo of promos) {
    const created = await prisma.promoCode.upsert({
      where: { code: promo.code },
      update: {
        description: promo.description,
        type: promo.type,
        value: promo.value,
        maxRedemptions: promo.maxRedemptions,
      },
      create: promo,
    });
    console.log(`  ✅ Promo: ${created.code} (${created.type} = ${created.value})`);
  }

  console.log("\n✅ Billing data seeded successfully!");
  console.log("\nTest the billing flow:");
  console.log("  1. Sign in as owner@demo.com / demo1234");
  console.log("  2. Go to /billing");
  console.log("  3. Try promo code: FREEMONTH (total becomes Rp 0)");
  console.log("  4. Or try HEMAT50 (50% off)");
}

function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n);
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
