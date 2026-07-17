/**
 * Migration Script: laundry-webapp (MariaDB) → pos-saas (PostgreSQL)
 *
 * Migrates: tenants, branches, users, customers, services, orders,
 *           order_items, payments, stock_items, deposit_transactions
 *
 * Strategy:
 *   - Create old tenants in pos-saas (skip if slug exists)
 *   - Build ID mapping: oldBranchId → newBranchId, oldTenantId → newTenantId
 *   - Copy all records with remapped FKs
 *
 * Usage: npx tsx scripts/migrate-from-laundry.ts
 */

import { Pool } from "pg";
import mysql from "mysql2/promise";

// ─── Connections ───
const pgPool = new Pool({
  host: "127.0.0.1",
  port: 5437,
  user: "posadmin",
  password: "poslocal",
  database: "pos_saas",
});

const mysqlConfig = {
  host: "127.0.0.1",
  port: 3306,
  user: "root",
  password: "laundry",
  database: "laundry_db",
};

// ─── ID Maps ───
const tenantIdMap = new Map<string, string>(); // old → new
const branchIdMap = new Map<string, string>(); // old → new
const customerIdMap = new Map<string, string>(); // old → new (per branch scope)
const serviceIdMap = new Map<string, string>(); // old → new
const orderIdMap = new Map<string, string>(); // old → new

async function main() {
  const mysqlConn = await mysql.createConnection(mysqlConfig);
  const pgClient = await pgPool.connect();

  console.log("🔄 Starting migration: laundry-webapp → pos-saas\n");

  try {
    // ─── 1. Tenants ───
    console.log("📋 Migrating tenants...");
    const [tenants]: any = await mysqlConn.execute("SELECT * FROM tenant");
    for (const t of tenants) {
      const existing = await pgClient.query(
        `SELECT id FROM "Tenant" WHERE slug = $1`,
        [t.slug]
      );
      if (existing.rows.length > 0) {
        tenantIdMap.set(t.id, existing.rows[0].id);
        console.log(`  ↳ Tenant "${t.name}" already exists, mapped`);
        continue;
      }
      const result = await pgClient.query(
        `INSERT INTO "Tenant" (id, name, slug, "ownerEmail", "isActive", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW()) RETURNING id`,
        [t.id, t.name, t.slug, t.ownerEmail, !!t.isActive]
      );
      tenantIdMap.set(t.id, result.rows[0].id);
      console.log(`  ✓ Created tenant: ${t.name}`);
    }

    // ─── 2. Branches ───
    console.log("\n📍 Migrating branches...");
    const [branches]: any = await mysqlConn.execute("SELECT * FROM branch");
    for (const b of branches) {
      const newTenantId = tenantIdMap.get(b.tenantId);
      if (!newTenantId) {
        console.log(`  ⚠ Skipping branch "${b.name}" — tenant not found`);
        continue;
      }
      // Check if branch already exists (by name + tenant)
      const existing = await pgClient.query(
        `SELECT id FROM "Branch" WHERE name = $1 AND "tenantId" = $2`,
        [b.name, newTenantId]
      );
      if (existing.rows.length > 0) {
        branchIdMap.set(b.id, existing.rows[0].id);
        console.log(`  ↳ Branch "${b.name}" already exists, mapped`);
      } else {
        const result = await pgClient.query(
          `INSERT INTO "Branch" (id, name, address, phone, "isActive", "tenantId", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW()) RETURNING id`,
          [b.id, b.name, b.address, b.phone, !!b.isActive, newTenantId]
        );
        branchIdMap.set(b.id, result.rows[0].id);
        console.log(`  ✓ Created branch: ${b.name}`);
      }
    }

    // ─── 3. Users ───
    console.log("\n👥 Migrating users...");
    const [users]: any = await mysqlConn.execute("SELECT * FROM user");
    for (const u of users) {
      const newTenantId = tenantIdMap.get(u.tenantId);
      const newBranchId = branchIdMap.get(u.branchId);
      if (!newTenantId || !newBranchId) {
        console.log(`  ⚠ Skipping user "${u.name}" — missing tenant/branch`);
        continue;
      }
      // Check if user already exists by email
      const existing = await pgClient.query(
        `SELECT id FROM "User" WHERE email = $1`,
        [u.email]
      );
      if (existing.rows.length > 0) {
        console.log(`  ↳ User "${u.email}" already exists, skipped`);
        continue;
      }
      await pgClient.query(
        `INSERT INTO "User" (id, email, "passwordHash", name, phone, role, "tenantId", "branchId", "isActive", "sessionVersion", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          u.id,
          u.email,
          u.passwordHash,
          u.name,
          u.phone || null,
          u.role,
          newTenantId,
          newBranchId,
          true,
          u.sessionVersion || 0,
          u.createdAt,
          u.updatedAt,
        ]
      );
      console.log(`  ✓ Created user: ${u.email}`);
    }

    // ─── 4. Services ───
    console.log("\n🧺 Migrating services...");
    const [services]: any = await mysqlConn.execute("SELECT * FROM service");
    let svcCount = 0;
    for (const s of services) {
      const newBranchId = branchIdMap.get(s.branchId);
      if (!newBranchId) continue;
      const existing = await pgClient.query(
        `SELECT id FROM "Service" WHERE name = $1 AND "branchId" = $2`,
        [s.name, newBranchId]
      );
      if (existing.rows.length > 0) {
        serviceIdMap.set(s.id, existing.rows[0].id);
        continue;
      }
      await pgClient.query(
        `INSERT INTO "Service" (id, name, description, "pricingType", "basePrice", "commissionType", "commissionValue", "isActive", "branchId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          s.id,
          s.name,
          s.description || null,
          s.pricingType,
          s.basePrice,
          s.commissionType || "NONE",
          s.commissionValue || 0,
          !!s.isActive,
          newBranchId,
          s.createdAt,
          s.updatedAt,
        ]
      );
      serviceIdMap.set(s.id, s.id);
      svcCount++;
    }
    console.log(`  ✓ Migrated ${svcCount} services (${services.length - svcCount} already existed)`);

    // ─── 5. Customers ───
    console.log("\n👤 Migrating customers...");
    const [customers]: any = await mysqlConn.execute("SELECT * FROM customer");
    let custCount = 0;
    for (const c of customers) {
      const newBranchId = branchIdMap.get(c.branchId);
      if (!newBranchId) continue;
      const existing = await pgClient.query(
        `SELECT id FROM "Customer" WHERE phone = $1 AND "branchId" = $2`,
        [c.phone, newBranchId]
      );
      if (existing.rows.length > 0) {
        customerIdMap.set(c.id, existing.rows[0].id);
        continue;
      }
      await pgClient.query(
        `INSERT INTO "Customer" (id, name, phone, email, notes, balance, "branchId", "createdAt", "updatedAt")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          c.id,
          c.name,
          c.phone || null,
          c.email || null,
          c.notes || null,
          c.balance || 0,
          newBranchId,
          c.createdAt,
          c.updatedAt,
        ]
      );
      customerIdMap.set(c.id, c.id);
      custCount++;
    }
    console.log(`  ✓ Migrated ${custCount} customers (${customers.length - custCount} already existed)`);

    // ─── 6. Orders ───
    console.log("\n📦 Migrating orders...");
    const [orders]: any = await mysqlConn.execute("SELECT * FROM `order`");
    let orderCount = 0;
    let orderSkipped = 0;
    for (const o of orders) {
      const newBranchId = branchIdMap.get(o.branchId);
      const newCustomerId = customerIdMap.get(o.customerId);
      if (!newBranchId || !newCustomerId) {
        orderSkipped++;
        continue;
      }
      const existing = await pgClient.query(
        // ponytail: check by id, not orderNumber — orderNumber is mutable
        // (backfill-order-numbers.ts renames ORD-* to tenant-prefixed CODE-*).
        // Legacy id is preserved verbatim on insert, so id is the stable key.
        `SELECT id FROM "Order" WHERE id = $1`,
        [o.id]
      );
      if (existing.rows.length > 0) {
        orderIdMap.set(o.id, existing.rows[0].id);
        continue;
      }
      await pgClient.query(
        `INSERT INTO "Order" (id, "orderNumber", "customerId", status, "totalAmount", "discountAmount", "discountType", "paidAmount", "paymentStatus", notes, "branchId", "createdAt", "updatedAt", "receivedAt", "inProgressAt", "readyAt", "deliveredAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          o.id, o.orderNumber, newCustomerId, o.status,
          o.totalAmount, o.discountAmount, o.discountType,
          o.paidAmount, o.paymentStatus, o.notes,
          newBranchId, o.createdAt, o.updatedAt,
          o.receivedAt, o.inProgressAt, o.readyAt, o.deliveredAt,
        ]
      );
      orderIdMap.set(o.id, o.id);
      orderCount++;
    }
    console.log(`  ✓ Migrated ${orderCount} orders (${orderSkipped} skipped, ${orders.length - orderCount - orderSkipped} already existed)`);

    // ─── 7. Order Items ───
    console.log("\n📋 Migrating order items...");
    const [items]: any = await mysqlConn.execute("SELECT * FROM orderitem");
    let itemCount = 0;
    for (const oi of items) {
      const newOrderId = orderIdMap.get(oi.orderId);
      const newServiceId = serviceIdMap.get(oi.serviceId);
      if (!newOrderId || !newServiceId) continue;
      const existing = await pgClient.query(
        `SELECT id FROM "OrderItem" WHERE "orderId" = $1 AND "serviceId" = $2`,
        [newOrderId, newServiceId]
      );
      if (existing.rows.length > 0) continue;
      await pgClient.query(
        `INSERT INTO "OrderItem" (id, "orderId", "serviceId", quantity, "weightKg", "pricePerUnit", subtotal, notes, "garmentBreakdown", "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          oi.id, newOrderId, newServiceId,
          oi.quantity, oi.weightKg, oi.pricePerUnit, oi.subtotal,
          oi.notes || null, oi.garmentBreakdown || null, oi.createdAt,
        ]
      );
      itemCount++;
    }
    console.log(`  ✓ Migrated ${itemCount} order items`);

    // ─── 8. Payments ───
    console.log("\n💰 Migrating payments...");
    const [payments]: any = await mysqlConn.execute("SELECT * FROM payment");
    let payCount = 0;
    for (const p of payments) {
      const newOrderId = orderIdMap.get(p.orderId);
      if (!newOrderId) continue;
      const existing = await pgClient.query(
        `SELECT id FROM "Payment" WHERE "orderId" = $1 AND amount = $2`,
        [newOrderId, p.amount]
      );
      if (existing.rows.length > 0) continue;
      await pgClient.query(
        `INSERT INTO "Payment" (id, "orderId", amount, "paymentMethod", notes, "paidAt", "createdAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [p.id, newOrderId, p.amount, p.paymentMethod, p.notes || null, p.paidAt, p.createdAt]
      );
      payCount++;
    }
    console.log(`  ✓ Migrated ${payCount} payments`);

    // ─── 9. Stock Items ───
    console.log("\n📦 Migrating stock items...");
    const [stock]: any = await mysqlConn.execute("SELECT * FROM stockitem");
    let stockCount = 0;
    for (const si of stock) {
      const newBranchId = branchIdMap.get(si.branchId);
      if (!newBranchId) continue;
      const existing = await pgClient.query(
        `SELECT id FROM "StockItem" WHERE name = $1 AND "branchId" = $2`,
        [si.name, newBranchId]
      );
      if (existing.rows.length > 0) continue;
      await pgClient.query(
        `INSERT INTO "StockItem" (id, name, unit, "currentQuantity", "lowStockThreshold", "purchasePricePerUnit", "isActive", "branchId", "createdAt", "updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          si.id, si.name, si.unit, si.currentQuantity,
          si.lowStockThreshold, si.purchasePricePerUnit,
          !!si.isActive, newBranchId, si.createdAt, si.updatedAt,
        ]
      );
      stockCount++;
    }
    console.log(`  ✓ Migrated ${stockCount} stock items`);

    // ─── Summary ───
    console.log("\n✅ Migration complete!\n");
    console.log("─".repeat(50));
    console.log(`  Tenants:    ${tenantIdMap.size} mapped`);
    console.log(`  Branches:   ${branchIdMap.size} mapped`);
    console.log(`  Users:      ${users.length} processed`);
    console.log(`  Customers:  ${custCount} new (${customers.length - custCount} existed)`);
    console.log(`  Services:   ${svcCount} new (${services.length - svcCount} existed)`);
    console.log(`  Orders:     ${orderCount} new (${orderSkipped} skipped)`);
    console.log(`  Order Items:${itemCount} migrated`);
    console.log(`  Payments:   ${payCount} migrated`);
    console.log(`  Stock:      ${stockCount} migrated`);
    console.log("─".repeat(50));

    // Verify counts in PG
    const verifyQuery = await pgClient.query(`
      SELECT 'Customer' as t, COUNT(*) as c FROM "Customer"
      UNION ALL SELECT 'Order', COUNT(*) FROM "Order"
      UNION ALL SELECT 'Service', COUNT(*) FROM "Service"
      UNION ALL SELECT 'OrderItem', COUNT(*) FROM "OrderItem"
      UNION ALL SELECT 'Payment', COUNT(*) FROM "Payment"
      UNION ALL SELECT 'User', COUNT(*) FROM "User"
      UNION ALL SELECT 'Branch', COUNT(*) FROM "Branch"
      UNION ALL SELECT 'Tenant', COUNT(*) FROM "Tenant"
      UNION ALL SELECT 'StockItem', COUNT(*) FROM "StockItem"
    `);
    console.log("\n📊 pos-saas DB totals:");
    for (const row of verifyQuery.rows) {
      console.log(`  ${row.t}: ${row.c}`);
    }
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await mysqlConn.end();
    pgClient.release();
    await pgPool.end();
  }
}

main();
