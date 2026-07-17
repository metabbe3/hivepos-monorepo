import type { PaymentStatus } from "./types";
import { Money } from "./money.vo";

/**
 * Derive the payment status from the amount paid vs the order total.
 *
 *   paid ≥ total → PAID
 *   paid > 0     → PARTIAL
 *   paid = 0     → PENDING
 *
 * Overpayment maps to PAID (the caller should have validated the amount,
 * but the status derivation is defensive).
 */
export function derivePaymentStatus(
  paidAmount: Money | number,
  totalAmount: Money | number,
): PaymentStatus {
  const paid = Money.from(paidAmount).amount;
  const total = Money.from(totalAmount).amount;

  if (paid >= total) return "PAID";
  if (paid > 0) return "PARTIAL";
  return "PENDING";
}
