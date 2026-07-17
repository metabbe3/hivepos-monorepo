import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ponytail: idempotent upsert by key. Updates name/description/category on
// re-run, but never resets `enabled` (so super-admin toggles survive reseed).
const FLAGS = [
  { key: "dashboard",      name: "Dashboard",                category: "general" },
  { key: "orders",         name: "Orders",                   category: "operations" },
  { key: "customers",      name: "Customers",                category: "operations" },
  { key: "services",       name: "Services & Pricing",       category: "operations" },
  { key: "inventory",      name: "Inventory",                category: "operations" },
  { key: "expenses",       name: "Expenses",                 category: "operations" },
  { key: "deposits",       name: "Customer Deposits",        category: "operations" },
  { key: "pickupRequests", name: "Pickup Requests",          category: "operations" },
  { key: "reports",        name: "Reports",                  category: "operations" },
  { key: "branches",       name: "Outlet Management",        category: "admin" },
  { key: "users",          name: "Staff Management",         category: "admin" },
  { key: "roles",          name: "Role Management",          category: "admin" },
  { key: "billing",        name: "Billing & Subscription",   category: "admin" },
  { key: "website",        name: "Public Website",           category: "growth" },
  { key: "tickets",        name: "Help / Bantuan",           category: "general" },
  { key: "offlineOrderCreate", name: "Offline Order Create", category: "general" },
  { key: "printerSettings", name: "Printer Settings", category: "general" },
  { key: "orderPhotos", name: "Order Proof Photos", category: "operations" },
  { key: "referralProgram", name: "Referral Program", category: "growth" },
  { key: "customersImportExport", name: "Customer CSV Import/Export", category: "operations" },
  { key: "onboardingWizard", name: "Onboarding Wizard", category: "growth" },
  { key: "orderFlowV2", name: "Order Flow V2 (leaner steps)", category: "operations" },
  { key: "staffAttendance", name: "Staff Attendance (clock-in)", category: "operations" },
] as const;

async function main() {
  console.log("🚩 Seeding feature flags...");
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: { name: f.name, category: f.category },
      create: {
        ...f,
        // ponytail: offlineOrderCreate + staffAttendance default OFF globally —
        // flip per-tenant via super-admin override during dogfood phase.
        enabled: f.key !== "offlineOrderCreate" && f.key !== "staffAttendance",
      },
    });
    console.log(`  ✓ ${f.key}`);
  }
  console.log(`Done. ${FLAGS.length} flags.`);
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
