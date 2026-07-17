"use client";

import { apiFetch, ApiClientError } from "@/modules/shared";
import {
  listPendingCustomers,
  listPendingOrders,
  updatePendingCustomer,
  updatePendingOrder,
  deletePendingCustomer,
  deletePendingOrder,
  type PendingCustomerRow,
  type PendingOrderRow,
} from "./db";

/**
 * Drain the offline outbox.
 *
 * ponytail: drains customers first (orders may reference them), then orders.
 * Failures stay in the outbox with `status: "error"` + lastError — sync loop
 * skips errored rows so the kasir sees them and can manually resolve
 * (delete + re-create, or fix the offending input).
 *
 * Retry policy: exponential backoff per-row, max 4 attempts, then park as
 * "error". Network errors retry; validation errors do not.
 */

const MAX_ATTEMPTS = 4;
// ponytail: drain rows in parallel chunks of this size within each phase
// (customers-then-orders). Phases stay sequential (orders may reference a
// customer synced this run); rows within a phase are independent. Chunked
// (not unbounded Promise.all) so a big offline burst doesn't overwhelm the
// server. 5 keeps the pool (25) + per-row tx comfortable.
const CHUNK = 5;

type SyncEvent =
  | { type: "started" }
  | { type: "customer-synced"; clientId: string; serverId: string }
  | { type: "order-synced"; clientId: string; serverId: string; orderNumber: string }
  | { type: "row-error"; clientId: string; error: string }
  | { type: "completed"; synced: number; errors: number };

type Listener = (e: SyncEvent) => void;

const listeners = new Set<Listener>();
let draining = false;

export function onSyncEvent(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(e: SyncEvent) {
  for (const fn of listeners) fn(e);
}

export async function drainOutbox(): Promise<{ synced: number; errors: number }> {
  if (draining) return { synced: 0, errors: 0 };
  draining = true;
  emit({ type: "started" });

  let synced = 0;
  let errors = 0;

  try {
    // 1. Customers first
    const customers = (await listPendingCustomers()).filter(
      (c) => c.status === "pending" || c.status === "syncing",
    );
    const customerIdMap = new Map<string, string>(); // pendingClientId → serverId

    // ponytail: customers are independent of each other → drain in parallel
    // chunks (was sequential, one HTTP per row). Customers still finish before
    // orders (orders may reference a customer synced this run via customerIdMap).
    for (let i = 0; i < customers.length; i += CHUNK) {
      const results = await Promise.all(
        customers.slice(i, i + CHUNK).map((row) => syncCustomer(row, customerIdMap)),
      );
      for (const ok of results) {
        if (ok) synced++;
        else errors++;
      }
    }

    // 2. Orders
    const orders = (await listPendingOrders()).filter(
      (o) => o.status === "pending" || o.status === "syncing",
    );
    // ponytail: orders are independent of each other (each resolves its own
    // customerId) → drain in parallel chunks. Order-number allocation is
    // concurrency-safe (transactional per-branch counter).
    for (let i = 0; i < orders.length; i += CHUNK) {
      const results = await Promise.all(
        orders.slice(i, i + CHUNK).map((row) => syncOrder(row, customerIdMap)),
      );
      for (const ok of results) {
        if (ok) synced++;
        else errors++;
      }
    }
  } finally {
    draining = false;
    emit({ type: "completed", synced, errors });
  }

  return { synced, errors };
}

async function lookupSyncedCustomerId(pendingClientId: string): Promise<string | undefined> {
  // ponytail: small reuse — if customer was synced on a previous drain,
  // pull its serverId out of IDB. Avoids re-POSTing the customer.
  const { getPendingCustomer } = await import("./db");
  const row = await getPendingCustomer(pendingClientId);
  return row?.serverId;
}

async function postWithRetry<T>(url: string, body: unknown, clientId: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { data } = await apiFetch<T>(url, {
        method: "POST",
        headers: { "X-Client-Id": clientId },
        body: body as Record<string, unknown>,
      });
      return data;
    } catch (err) {
      lastErr = err;
      // ponytail: 4xx is a validation/authorization problem — retrying
      // won't fix it. 5xx and network errors do retry.
      if (err instanceof ApiClientError && err.httpStatus >= 400 && err.httpStatus < 500) {
        throw err;
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(Math.pow(2, attempt - 1) * 1000); // 1s, 2s, 4s, 8s
      }
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("sync failed");
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Sync one customer. Returns true on success, false on failure (status + emit handled). */
async function syncCustomer(
  row: PendingCustomerRow,
  customerIdMap: Map<string, string>,
): Promise<boolean> {
  try {
    await updatePendingCustomer(row.clientId, { status: "syncing", lastError: undefined });
    // ponytail: strip null/undefined — customerSchema rejects null on optional
    // string fields. IDB stores empty phone as null; the online form path sends
    // "" so the schema is shaped for that. Cleanest fix is at the sync boundary.
    const customerBody: Record<string, unknown> = { name: row.payload.name };
    if (row.payload.phone) customerBody.phone = row.payload.phone;
    if (row.payload.email) customerBody.email = row.payload.email;
    if (row.payload.notes) customerBody.notes = row.payload.notes;
    const server = await postWithRetry<{ id: string }>("/api/customers", customerBody, row.clientId);
    await updatePendingCustomer(row.clientId, {
      status: "synced",
      serverId: server.id,
      syncedAt: new Date().toISOString(),
    });
    customerIdMap.set(row.clientId, server.id);
    emit({ type: "customer-synced", clientId: row.clientId, serverId: server.id });
    return true;
  } catch (err) {
    const msg = errMsg(err);
    await updatePendingCustomer(row.clientId, { status: "error", lastError: msg });
    emit({ type: "row-error", clientId: row.clientId, error: msg });
    return false;
  }
}

/** Sync one order. Returns true on success, false on failure (status + emit handled). */
async function syncOrder(
  row: PendingOrderRow,
  customerIdMap: Map<string, string>,
): Promise<boolean> {
  try {
    let customerId: string | undefined = row.customerId;
    if (row.pendingCustomerId) {
      // Check customerIdMap first (just synced this run), else IDB (previous run).
      customerId =
        customerIdMap.get(row.pendingCustomerId) ??
        (await lookupSyncedCustomerId(row.pendingCustomerId)) ??
        undefined;
    }
    if (!customerId) {
      throw new Error("Customer not yet synced — will retry on next drain");
    }

    await updatePendingOrder(row.clientId, { status: "syncing", lastError: undefined });
    const server = await postWithRetry<{ id: string; orderNumber: string }>(
      "/api/orders",
      {
        customerId,
        items: row.payload.items,
        notes: row.payload.notes,
        discountType: row.payload.discountType,
        discountAmount: row.payload.discountAmount,
        receivedAt: row.payload.receivedAt,
      },
      row.clientId,
    );
    await updatePendingOrder(row.clientId, {
      status: "synced",
      serverId: server.id,
      serverOrderNumber: server.orderNumber,
      syncedAt: new Date().toISOString(),
    });
    emit({
      type: "order-synced",
      clientId: row.clientId,
      serverId: server.id,
      orderNumber: server.orderNumber,
    });
    return true;
  } catch (err) {
    const msg = errMsg(err);
    await updatePendingOrder(row.clientId, { status: "error", lastError: msg });
    emit({ type: "row-error", clientId: row.clientId, error: msg });
    return false;
  }
}

/**
 * Drop synced rows older than 24h. Called by the layout on a slow interval
 * to keep IDB from growing unbounded.
 */
const SYNCED_TTL_MS = 24 * 60 * 60 * 1000;

export async function purgeOldSyncedRows(): Promise<void> {
  const cutoff = Date.now() - SYNCED_TTL_MS;
  const customers = await listPendingCustomers();
  const orders = await listPendingOrders();
  for (const c of customers) {
    if (c.status === "synced" && c.syncedAt && new Date(c.syncedAt).getTime() < cutoff) {
      await deletePendingCustomer(c.clientId);
    }
  }
  for (const o of orders) {
    if (o.status === "synced" && o.syncedAt && new Date(o.syncedAt).getTime() < cutoff) {
      await deletePendingOrder(o.clientId);
    }
  }
}
