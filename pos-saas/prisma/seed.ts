import { PrismaClient, PlanTier } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcrypt";
import pg from "pg";
import "dotenv/config";
import { seedDefaultRoles, backfillUserRoles } from "../lib/permissions/seed";
import { TRIAL_DAYS } from "../lib/billing";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // ── Plans ──
  const plans = [
    {
      name: "Free",
      description: "Untuk bisnis yang baru memulai",
      tier: PlanTier.FREE,
      maxOutlets: 1,
      maxUsers: 2,
      maxOrders: 100,
      priceMonthly: 0,
      priceYearly: 0,
      modules: ["laundry"],
      features: { customBranding: false, api: false, whatsapp: false, website: false },
    },
    {
      name: "Growth",
      description: "Per-outlet — semua modul",
      tier: PlanTier.GROWTH,
      maxOutlets: 999999,
      maxUsers: 999999,
      maxOrders: 999999,
      priceMonthly: 49000,
      priceYearly: 490000,
      modules: ["laundry", "salon", "cleaning", "fnb"],
      features: { customBranding: true, api: false, whatsapp: true, website: false },
    },
    {
      name: "Pro",
      description: "Growth + website laundry profesional",
      tier: PlanTier.PRO,
      maxOutlets: 999999,
      maxUsers: 999999,
      maxOrders: 999999,
      priceMonthly: 79000,
      priceYearly: 790000,
      modules: ["laundry", "salon", "cleaning", "fnb"],
      features: { customBranding: true, api: false, whatsapp: true, website: true },
    },
  ];

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    });
    console.log(`  ✅ Plan: ${plan.name}`);
  }

  // ── Super Admin ──
  const adminEmail = "admin@possaas.id";
  const existingAdmin = await prisma.superAdmin.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash("admin123", 12);
    await prisma.superAdmin.create({
      data: {
        email: adminEmail,
        passwordHash,
        name: "Super Admin",
        role: "SUPER_ADMIN",
      },
    });
    console.log("  ✅ Super Admin: admin@possaas.id / admin123");
  } else {
    console.log("  ⏭️ Super Admin already exists");
  }

  // ── Demo Tenant ──
  const demoSlug = "demo-laundry";
  const existingDemo = await prisma.tenant.findUnique({
    where: { slug: demoSlug },
  });

  if (!existingDemo) {
    const passwordHash = await bcrypt.hash("demo1234", 12);
    const freePlan = await prisma.plan.findFirst({ where: { name: "Free" } });

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          name: "Demo Laundry",
          slug: demoSlug,
          ownerEmail: "owner@demo.com",
          ownerName: "Demo Owner",
          ownerPhone: "081200000000",
          activeModules: ["laundry"],
          approvedAt: new Date(),
          trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          trialTier: "GROWTH",
        },
      });

      const branch = await tx.branch.create({
        data: {
          name: "Outlet Pusat",
          tenantId: tenant.id,
          slug: "outlet-pusat",
          pickupSlots: [
            { day: "MON", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
            { day: "TUE", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
            { day: "WED", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
            { day: "THU", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
            { day: "FRI", slots: ["09:00-11:00", "13:00-15:00", "17:00-19:00"] },
            { day: "SAT", slots: ["09:00-11:00", "13:00-15:00"] },
          ],
        },
      });

      await tx.user.create({
        data: {
          email: "owner@demo.com",
          passwordHash,
          name: "Demo Owner",
          phone: "081200000000",
          role: "OWNER",
          tenantId: tenant.id,
          branchId: branch.id,
        },
      });

      // Seed RBAC roles + link the owner user to the Owner role.
      const roleMap = await seedDefaultRoles(tx, tenant.id);
      await backfillUserRoles(tx, tenant.id, roleMap);

      if (freePlan) {
        await tx.subscription.create({
          data: {
            tenantId: tenant.id,
            planId: freePlan.id,
            status: "TRIAL",
            currentPeriodEnd: new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000),
          },
        });
      }

      // Default services
      const services = [
        { name: "Cuci Kering", pricingType: "PER_KG" as const, basePrice: 7000 },
        { name: "Cuci Setrika", pricingType: "PER_KG" as const, basePrice: 10000 },
        { name: "Cuci Setrika Express", pricingType: "PER_KG" as const, basePrice: 15000 },
        { name: "Cuci Sepatu", pricingType: "PER_ITEM" as const, basePrice: 25000 },
        { name: "Cuci Bedcover", pricingType: "PER_ITEM" as const, basePrice: 30000 },
      ];

      await tx.service.createMany({
        data: services.map((s) => ({ ...s, branchId: branch.id })),
      });

      // Sample pending pickup request for demoing the pickup flow.
      await tx.pickupRequest.create({
        data: {
          tenantId: tenant.id,
          branchId: branch.id,
          module: "LAUNDRY",
          customerName: "Pelanggan Contoh",
          customerPhone: "081234567890",
          customerEmail: "pelanggan@contoh.com",
          addressText: "Jl. Contoh No. 123, Jakarta Pusat",
          latitude: -6.1764,
          longitude: 106.8263,
          mapsLink: "https://www.google.com/maps?q=-6.1764,106.8263",
          notes: "Cuci setrika sekitar 5kg, ada kemeja kerja.",
          status: "PENDING",
        },
      });

      return tenant;
    });

    console.log("  ✅ Demo Tenant: owner@demo.com / demo1234");
  } else {
    console.log("  ⏭️ Demo tenant already exists");
  }

  console.log("\n✅ Seed complete!");
  console.log("   Super Admin: admin@possaas.id / admin123");
  console.log("   Demo Owner:  owner@demo.com / demo1234");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
