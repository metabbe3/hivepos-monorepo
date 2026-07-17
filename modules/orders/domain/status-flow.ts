import type { OrderStatus } from "./types";

/**
 * Valid forward status transitions for an order.
 *
 *   RECEIVED → IN_PROGRESS → READY → DELIVERED
 *
 * CANCELED is terminal and has no outgoing transitions.
 * DELIVERED is terminal.
 */
export const STATUS_FLOW: Record<OrderStatus, OrderStatus | null> = {
  RECEIVED: "IN_PROGRESS",
  IN_PROGRESS: "READY",
  READY: "DELIVERED",
  DELIVERED: null,
  CANCELED: null,
};

/** Maps each status to the timestamp field that should be set on entry. */
export const STATUS_TIMESTAMP: Record<OrderStatus, string | null> = {
  RECEIVED: "receivedAt",
  IN_PROGRESS: "inProgressAt",
  READY: "readyAt",
  DELIVERED: "deliveredAt",
  CANCELED: null,
};

/** True if the status is terminal (no further transitions allowed). */
export function isTerminalStatus(status: OrderStatus): boolean {
  return STATUS_FLOW[status] === null;
}

/** True if transitioning from `from` to `to` is a valid single-step forward move. */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return STATUS_FLOW[from] === to;
}

/**
 * Assert that the transition is valid. Throws a descriptive Error if not.
 *
 * Used by the domain entity and validated by the application service test.
 */
export function assertCanTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransition(from, to);
  }
}

/** Custom error for invalid transitions — caught by the application layer. */
export class InvalidTransition extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Cannot transition order status from ${from} to ${to}`);
    this.name = "InvalidTransition";
  }
}
