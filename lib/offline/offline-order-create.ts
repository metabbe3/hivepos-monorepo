"use client";

import { newClientId } from "./client-id";
import {
  putPendingOrder,
  putPendingCustomer,
  type PendingOrderRow,
  type PendingCustomerRow,
  type PendingOrderItem,
} from "./db";

/**
 * What the form passes us. Mirrors the shape the online POST currently sends
 * so we can reuse the same validation path on the server at sync time.
 */
export interface OfflineOrderInput {
  // Exactly one of {existingCustomerId, newCustomer} is set.
  existingCustomerId?: string;
  newCustomer?: { name: string; phone?: string | null; email?: string | null; notes?: string | null };
  items: PendingOrderItem[];
  notes?: string;
  discountType?: "PERCENTAGE" | "FIXED";
  discountAmount?: number;
  receivedAt?: string;
  // Snapshot for receipt rendering while offline.
  pricedItems: PendingOrderRow["pricedItems"];
  totalAmount: number;
  branchId: string;
  module: string;
}

/**
 * Write an order + (optional) walk-in customer to IndexedDB for later sync.
 *
 * Returns the new clientId(s) so the caller can show a PENDING receipt with
 * `PENDING-${clientId.slice(0,6).toUpperCase()}` and navigate to the
 * pending list.
 */
export async function createOrderOffline(
  input: OfflineOrderInput,
): Promise<{ orderClientId: string; customerClientId?: string }> {
  const orderClientId = newClientId();
  let customerClientId: string | undefined;

  if (input.newCustomer) {
    customerClientId = newClientId();
    const customerRow: PendingCustomerRow = {
      clientId: customerClientId,
      status: "pending",
      payload: {
        name: input.newCustomer.name,
        phone: input.newCustomer.phone || null,
        email: input.newCustomer.email || null,
        notes: input.newCustomer.notes || null,
      },
      createdAt: new Date().toISOString(),
    };
    await putPendingCustomer(customerRow);
  }

  const orderRow: PendingOrderRow = {
    clientId: orderClientId,
    status: "pending",
    pendingCustomerId: customerClientId,
    customerId: input.existingCustomerId,
    payload: {
      items: input.items,
      notes: input.notes,
      discountType: input.discountType,
      discountAmount: input.discountAmount,
      receivedAt: input.receivedAt,
    },
    pricedItems: input.pricedItems,
    totalAmount: input.totalAmount,
    discountAmount: input.discountAmount ?? 0,
    branchId: input.branchId,
    module: input.module,
    createdAt: new Date().toISOString(),
  };
  await putPendingOrder(orderRow);

  return { orderClientId, customerClientId };
}
