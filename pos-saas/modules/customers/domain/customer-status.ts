import type { CustomerStatus } from "./types";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;

/**
 * Derive customer status from their activity timestamps.
 *
 * Rules (matching the original inline route logic):
 * - NEW: registered within 30 days AND has zero orders
 * - LAPSED: no orders ever (after the 30-day new window) OR last order > 90 days
 * - ACTIVE: last order within 30 days
 * - AT_RISK: last order between 30–90 days
 *
 * Pure function — no side effects, fully deterministic given `now`.
 */
export function deriveCustomerStatus(
  createdAt: Date,
  lastOrderDate: Date | null,
  totalOrders: number,
  now: number = Date.now(),
): CustomerStatus {
  if (now - createdAt.getTime() < THIRTY_DAYS && totalOrders === 0) {
    return "NEW";
  }

  if (!lastOrderDate) {
    return "LAPSED";
  }

  const daysSince = now - lastOrderDate.getTime();

  if (daysSince <= THIRTY_DAYS) return "ACTIVE";
  if (daysSince <= NINETY_DAYS) return "AT_RISK";
  return "LAPSED";
}

/** Days since last order, or null if the customer has never ordered. */
export function daysSinceLastOrder(
  lastOrderDate: Date | null,
  now: number = Date.now(),
): number | null {
  if (!lastOrderDate) return null;
  return Math.floor((now - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24));
}
