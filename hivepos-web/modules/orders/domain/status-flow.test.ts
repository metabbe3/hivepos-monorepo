import { describe, it, expect } from "vitest";
import {
  STATUS_FLOW,
  STATUS_TIMESTAMP,
  canTransition,
  isTerminalStatus,
  assertCanTransition,
  InvalidTransition,
} from "./status-flow";
import type { OrderStatus } from "./types";

describe("STATUS_FLOW", () => {
  it("defines the forward-only chain RECEIVED → IN_PROGRESS → READY → DELIVERED", () => {
    expect(STATUS_FLOW.RECEIVED).toBe("IN_PROGRESS");
    expect(STATUS_FLOW.IN_PROGRESS).toBe("READY");
    expect(STATUS_FLOW.READY).toBe("DELIVERED");
  });

  it("marks DELIVERED and CANCELED as terminal (null)", () => {
    expect(STATUS_FLOW.DELIVERED).toBeNull();
    expect(STATUS_FLOW.CANCELED).toBeNull();
  });
});

describe("STATUS_TIMESTAMP", () => {
  it("maps each status to the right timestamp field", () => {
    expect(STATUS_TIMESTAMP.RECEIVED).toBe("receivedAt");
    expect(STATUS_TIMESTAMP.IN_PROGRESS).toBe("inProgressAt");
    expect(STATUS_TIMESTAMP.READY).toBe("readyAt");
    expect(STATUS_TIMESTAMP.DELIVERED).toBe("deliveredAt");
    expect(STATUS_TIMESTAMP.CANCELED).toBeNull();
  });
});

describe("isTerminalStatus", () => {
  it("returns true for DELIVERED and CANCELED", () => {
    expect(isTerminalStatus("DELIVERED")).toBe(true);
    expect(isTerminalStatus("CANCELED")).toBe(true);
  });

  it("returns false for non-terminal statuses", () => {
    expect(isTerminalStatus("RECEIVED")).toBe(false);
    expect(isTerminalStatus("IN_PROGRESS")).toBe(false);
    expect(isTerminalStatus("READY")).toBe(false);
  });
});

describe("canTransition", () => {
  const validCases: Array<[OrderStatus, OrderStatus]> = [
    ["RECEIVED", "IN_PROGRESS"],
    ["IN_PROGRESS", "READY"],
    ["READY", "DELIVERED"],
  ];

  for (const [from, to] of validCases) {
    it(`allows ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  }

  const invalidCases: Array<[OrderStatus, OrderStatus]> = [
    ["RECEIVED", "READY"], // skipping a step
    ["RECEIVED", "DELIVERED"], // skipping multiple steps
    ["IN_PROGRESS", "DELIVERED"], // skipping READY
    ["READY", "RECEIVED"], // backwards
    ["DELIVERED", "RECEIVED"], // terminal → anything
    ["CANCELED", "RECEIVED"], // terminal → anything
    ["READY", "IN_PROGRESS"], // backwards
  ];

  for (const [from, to] of invalidCases) {
    it(`rejects ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(false);
    });
  }
});

describe("assertCanTransition", () => {
  it("does not throw for valid transitions", () => {
    expect(() => assertCanTransition("RECEIVED", "IN_PROGRESS")).not.toThrow();
  });

  it("throws InvalidTransition for invalid transitions", () => {
    expect(() => assertCanTransition("RECEIVED", "DELIVERED")).toThrow(InvalidTransition);
    expect(() => assertCanTransition("DELIVERED", "RECEIVED")).toThrow(InvalidTransition);
  });

  it("includes from/to in the error for debugging", () => {
    try {
      assertCanTransition("READY", "RECEIVED");
    } catch (e) {
      const err = e as InvalidTransition;
      expect(err.from).toBe("READY");
      expect(err.to).toBe("RECEIVED");
      expect(err.message).toContain("READY");
      expect(err.message).toContain("RECEIVED");
    }
  });
});
