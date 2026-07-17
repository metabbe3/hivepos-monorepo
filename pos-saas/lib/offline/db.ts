import { openDB, type IDBPDatabase } from "idb";

/**
 * IndexedDB layout for offline order creation.
 *
 * ponytail: caches + outbox live in a single DB so we open one connection
 * and manage all of them together. If a future feature needs more stores
 * (e.g. offline inventory), add them here rather than spawning a second DB.
 *
 * Stores:
 *   - customers (cache): hot list for offline search. Refreshed on login +
 *     every 5 min when online (see sync-engine).
 *   - services  (cache): price catalog for offline pricing + service-name
 *     display. Refreshed on login + every 1 hour when online.
 *   - pendingCustomers (outbox): walk-in customers created offline.
 *   - pendingOrders     (outbox): orders created offline.
 *
 *   pending* rows carry { clientId, status, payload, createdAt, syncedAt?,
 *   serverId?, serverOrderNumber?, lastError? }.
 */

export type PendingStatus = "pending" | "syncing" | "synced" | "error";

export interface PendingCustomerRow {
  clientId: string;
  status: PendingStatus;
  payload: {
    name: string;
    phone?: string | null;
    email?: string | null;
    notes?: string | null;
  };
  createdAt: string; // ISO
  syncedAt?: string;
  serverId?: string; // customer.id from server after sync
  lastError?: string;
}

export interface PendingOrderItem {
  serviceId: string;
  quantity: number;
  weightKg?: number;
  notes?: string;
  garmentBreakdown?: Array<{ name: string; qty: number }>;
}

export interface PendingOrderRow {
  clientId: string;
  status: PendingStatus;
  // ponytail: pendingCustomerId points at a PendingCustomerRow.clientId when
  // the kasir created a walk-in customer offline. The sync engine drains
  // pendingCustomers first, then swaps the server-issued customer id in here
  // before POSTing the order.
  pendingCustomerId?: string;
  // customerId is set when the kasir picked an existing cached customer.
  // Mutually exclusive with pendingCustomerId at write-time.
  customerId?: string;
  payload: {
    items: PendingOrderItem[];
    notes?: string;
    discountType?: "PERCENTAGE" | "FIXED";
    discountAmount?: number;
    receivedAt?: string;
  };
  // Cached pricing snapshot at create-time so the receipt matches what the
  // kasir quoted the customer. Server may still re-price on sync.
  pricedItems: Array<{
    serviceName: string;
    quantity: number;
    weightKg: number | null;
    pricePerUnit: number;
    subtotal: number;
  }>;
  totalAmount: number;
  discountAmount: number;
  branchId: string;
  module: string;
  createdAt: string; // ISO
  syncedAt?: string;
  serverId?: string;
  serverOrderNumber?: string;
  lastError?: string;
}

const DB_NAME = "hivepos-offline";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getDB(): Promise<IDBPDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB unavailable (SSR or private mode)"));
  }
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("customers")) {
          db.createObjectStore("customers", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("services")) {
          db.createObjectStore("services", { keyPath: "id" });
        }
        if (!db.objectStoreNames.contains("pendingCustomers")) {
          db.createObjectStore("pendingCustomers", { keyPath: "clientId" });
        }
        if (!db.objectStoreNames.contains("pendingOrders")) {
          const store = db.createObjectStore("pendingOrders", { keyPath: "clientId" });
          store.createIndex("byStatus", "status");
          store.createIndex("byPendingCustomer", "pendingCustomerId");
        }
        // v2: form drafts (autosave for New Order, extensible to other forms)
        if (!db.objectStoreNames.contains("formDrafts")) {
          db.createObjectStore("formDrafts", { keyPath: "route" });
        }
      },
    });
  }
  return dbPromise;
}

// ── Pending customer outbox ─────────────────────────────────────────────

export async function putPendingCustomer(row: PendingCustomerRow): Promise<void> {
  const db = await getDB();
  await db.put("pendingCustomers", row);
}

export async function getPendingCustomer(clientId: string): Promise<PendingCustomerRow | undefined> {
  const db = await getDB();
  return (await db.get("pendingCustomers", clientId)) as PendingCustomerRow | undefined;
}

export async function listPendingCustomers(): Promise<PendingCustomerRow[]> {
  const db = await getDB();
  return (await db.getAll("pendingCustomers")) as PendingCustomerRow[];
}

export async function updatePendingCustomer(
  clientId: string,
  patch: Partial<PendingCustomerRow>,
): Promise<void> {
  const db = await getDB();
  const existing = (await db.get("pendingCustomers", clientId)) as PendingCustomerRow | undefined;
  if (!existing) return;
  await db.put("pendingCustomers", { ...existing, ...patch });
}

export async function deletePendingCustomer(clientId: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingCustomers", clientId);
}

// ── Pending order outbox ────────────────────────────────────────────────

export async function putPendingOrder(row: PendingOrderRow): Promise<void> {
  const db = await getDB();
  await db.put("pendingOrders", row);
}

export async function getPendingOrder(clientId: string): Promise<PendingOrderRow | undefined> {
  const db = await getDB();
  return (await db.get("pendingOrders", clientId)) as PendingOrderRow | undefined;
}

export async function listPendingOrders(): Promise<PendingOrderRow[]> {
  const db = await getDB();
  return (await db.getAll("pendingOrders")) as PendingOrderRow[];
}

export async function updatePendingOrder(
  clientId: string,
  patch: Partial<PendingOrderRow>,
): Promise<void> {
  const db = await getDB();
  const existing = (await db.get("pendingOrders", clientId)) as PendingOrderRow | undefined;
  if (!existing) return;
  await db.put("pendingOrders", { ...existing, ...patch });
}

export async function deletePendingOrder(clientId: string): Promise<void> {
  const db = await getDB();
  await db.delete("pendingOrders", clientId);
}

// ── Customer + service caches ───────────────────────────────────────────

export async function setCachedCustomers(rows: Array<{ id: string; [k: string]: unknown }>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("customers", "readwrite");
  await tx.store.clear();
  for (const row of rows) await tx.store.put(row);
  await tx.done;
}

export async function searchCachedCustomers(query: string): Promise<Array<{ id: string; name: string; phone: string | null; email: string | null }>> {
  const db = await getDB();
  const all = (await db.getAll("customers")) as Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  }>;
  if (!query.trim()) return all.slice(0, 50);
  const q = query.toLowerCase();
  return all
    .filter((c) => c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q))
    .slice(0, 50);
}

export async function setCachedServices(rows: Array<{ id: string; [k: string]: unknown }>): Promise<void> {
  const db = await getDB();
  const tx = db.transaction("services", "readwrite");
  await tx.store.clear();
  for (const row of rows) await tx.store.put(row);
  await tx.done;
}

export async function getCachedServices(): Promise<Array<{ id: string; name: string; pricingType: string; basePrice: number; module: string; groupId: string | null; isActive: boolean }>> {
  const db = await getDB();
  return (await db.getAll("services")) as Array<{
    id: string;
    name: string;
    pricingType: string;
    basePrice: number;
    module: string;
    groupId: string | null;
    isActive: boolean;
  }>;
}
