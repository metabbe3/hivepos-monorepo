// Midtrans Snap integration.
// In dev mode (no MIDTRANS_SERVER_KEY), functions return null so the
// checkout flow can auto-complete without a real Midtrans account.

import crypto from "node:crypto";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Midtrans = require("midtrans-client");

const serverKey = process.env.MIDTRANS_SERVER_KEY ?? "";
const clientKey = process.env.MIDTRANS_CLIENT_KEY ?? "";
const isProduction = (process.env.MIDTRANS_ENV ?? "sandbox") === "production";

/** True when no Midtrans keys are configured (dev/local fallback). */
export const isDevMode = !serverKey;

let snapInstance: any = null;

function getSnap() {
  if (!serverKey) return null;
  if (!snapInstance) {
    snapInstance = new Midtrans.Snap({
      isProduction,
      serverKey,
      clientKey,
    });
  }
  return snapInstance;
}

export interface SnapTransactionParams {
  orderId: string;
  amount: number;
  tenantName: string;
  ownerEmail: string;
  months: number;
  outletCount: number;
}

export interface SnapTransactionResult {
  snapToken: string;
  redirectUrl: string;
}

/**
 * Create a Midtrans Snap transaction.
 * Returns null in dev mode (no keys) — caller should auto-complete the payment.
 */
export async function createSnapTransaction(
  params: SnapTransactionParams,
): Promise<SnapTransactionResult | null> {
  const snap = getSnap();
  if (!snap) return null;

  const { orderId, amount, tenantName, ownerEmail, months, outletCount } = params;

  const parameter = {
    transaction_details: {
      order_id: orderId,
      gross_amount: amount,
    },
    item_details: [
      {
        id: "subscription",
        name: `hivePOS Subscription (${outletCount} outlet, ${months} bln)`,
        quantity: 1,
        price: amount,
      },
    ],
    customer_details: {
      first_name: tenantName.slice(0, 50),
      email: ownerEmail,
    },
    // Metadata for webhook reconciliation
    custom_field1: `outlets:${outletCount}`,
    custom_field2: `months:${months}`,
  };

  const response = await snap.createTransaction(parameter);
  return {
    snapToken: response.token,
    redirectUrl: response.redirect_url,
  };
}

export interface MidtransNotification {
  orderId: string;
  transactionStatus: string;
  fraudStatus?: string;
  grossAmount?: string;
  statusCode?: string;
  signatureKey?: string;
}

/**
 * Verify Midtrans webhook signature: sha512(order_id + status_code + gross_amount + server_key).
 * Returns false if any required input is missing.
 */
export function verifySignature(notification: MidtransNotification): boolean {
  if (!serverKey) return false;
  const { orderId, statusCode, grossAmount, signatureKey } = notification;
  if (!orderId || !statusCode || !grossAmount || !signatureKey) return false;
  const input = orderId + statusCode + grossAmount + serverKey;
  const hash = crypto.createHash("sha512").update(input).digest("hex");
  return hash === signatureKey;
}

/**
 * Parse a Midtrans webhook notification body.
 * Call `verifySignature` on the result before trusting the notification.
 */
export function parseNotification(body: any): MidtransNotification {
  return {
    orderId: body.order_id ?? "",
    transactionStatus: body.transaction_status ?? "",
    fraudStatus: body.fraud_status,
    grossAmount: body.gross_amount,
    statusCode: body.status_code,
    signatureKey: body.signature_key,
  };
}

/** Is the transaction status considered successful? */
export function isSuccessfulStatus(status: string): boolean {
  const success = ["capture", "settlement"];
  return success.includes(status);
}

/** Is the transaction status a terminal failure? */
export function isFailedStatus(status: string): boolean {
  const failed = ["deny", "expire", "cancel", "failure"];
  return failed.includes(status);
}

/** Expose client key to the frontend (safe — client key is public). */
export function getClientKey(): string {
  return clientKey;
}

/** Expose Snap API URL for frontend script loading. */
export function getSnapUrl(): string {
  return isProduction
    ? "https://app.midtrans.com/snap/snap.js"
    : "https://app.sandbox.midtrans.com/snap/snap.js";
}
