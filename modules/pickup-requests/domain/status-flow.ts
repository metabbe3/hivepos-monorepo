import type { PickupRequestStatus } from "./types";

/**
 * Valid status transitions for a pickup request.
 *
 * Unlike the linear Order flow (RECEIVED → IN_PROGRESS → READY → DELIVERED),
 * pickup requests branch: a PENDING request can be ACCEPTED, REJECTED, or
 * CANCELED. ACCEPTED can still be REJECTED or CANCELED. Once SCHEDULED, the
 * only forward move is CONVERTED.
 *
 * Terminal states: CONVERTED, REJECTED, CANCELED.
 */
export const PICKUP_TRANSITIONS: Record<PickupRequestStatus, PickupRequestStatus[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELED"],
  ACCEPTED: ["SCHEDULED", "REJECTED", "CANCELED"],
  SCHEDULED: ["CONVERTED", "CANCELED"],
  CONVERTED: [],
  REJECTED: [],
  CANCELED: [],
};

/** True if transitioning from `from` to `to` is allowed. */
export function canTransition(
  from: PickupRequestStatus,
  to: PickupRequestStatus,
): boolean {
  return PICKUP_TRANSITIONS[from]?.includes(to) ?? false;
}

/** True if the status is terminal (no further transitions allowed). */
export function isTerminalStatus(status: PickupRequestStatus): boolean {
  return PICKUP_TRANSITIONS[status].length === 0;
}

/** Custom error for invalid transitions — caught by the application layer. */
export class InvalidPickupTransition extends Error {
  constructor(
    public readonly from: PickupRequestStatus,
    public readonly to: PickupRequestStatus,
  ) {
    super(`Cannot transition pickup request from ${from} to ${to}`);
    this.name = "InvalidPickupTransition";
  }
}

/** Assert that the transition is valid; throws InvalidPickupTransition if not. */
export function assertCanTransition(
  from: PickupRequestStatus,
  to: PickupRequestStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidPickupTransition(from, to);
  }
}
