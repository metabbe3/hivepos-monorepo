/**
 * Pure domain logic for stock movements.
 *
 * These functions contain the core business rules:
 * - IN always increases quantity
 * - OUT decreases quantity and CANNOT make it negative
 * - ADJUSTMENT can go either direction (used for corrections)
 */

import type { StockMovementType } from "./types";

/**
 * Calculate the resulting quantity after applying a movement.
 *
 * Returns `null` when the movement is invalid (e.g. OUT that would make
 * quantity negative). Callers should check for null and surface a
 * ValidationError.
 */
export function applyMovement(
  currentQty: number,
  type: StockMovementType,
  qty: number,
): number | null {
  switch (type) {
    case "IN":
      if (qty < 0) return null;
      return currentQty + qty;
    case "OUT": {
      if (qty < 0) return null;
      const result = currentQty - qty;
      return result < 0 ? null : result;
    }
    case "ADJUSTMENT":
      // ADJUSTMENT applies a signed delta — positive or negative.
      // Adjustments can result in negative stock (shrinkage corrections).
      return currentQty + qty;
    default:
      return null;
  }
}

/**
 * Check whether a movement can be applied without making quantity negative.
 */
export function canApplyMovement(
  currentQty: number,
  type: StockMovementType,
  qty: number,
): boolean {
  return applyMovement(currentQty, type, qty) !== null;
}
