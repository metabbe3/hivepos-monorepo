import { describe, it, expect } from "vitest";
import {
  PICKUP_TRANSITIONS,
  canTransition,
  isTerminalStatus,
  assertCanTransition,
  InvalidPickupTransition,
} from "./status-flow";
import type { PickupRequestStatus } from "./types";

describe("PICKUP_TRANSITIONS", () => {
  it("allows PENDING → ACCEPTED / REJECTED / CANCELED", () => {
    expect(PICKUP_TRANSITIONS.PENDING).toEqual(
      expect.arrayContaining(["ACCEPTED", "REJECTED", "CANCELED"]),
    );
  });

  it("allows ACCEPTED → SCHEDULED / REJECTED / CANCELED", () => {
    expect(PICKUP_TRANSITIONS.ACCEPTED).toEqual(
      expect.arrayContaining(["SCHEDULED", "REJECTED", "CANCELED"]),
    );
  });

  it("allows SCHEDULED → CONVERTED / CANCELED only", () => {
    expect(PICKUP_TRANSITIONS.SCHEDULED).toEqual(
      expect.arrayContaining(["CONVERTED", "CANCELED"]),
    );
    expect(PICKUP_TRANSITIONS.SCHEDULED).not.toContain("REJECTED");
  });

  it("marks CONVERTED, REJECTED, CANCELED as terminal (empty)", () => {
    expect(PICKUP_TRANSITIONS.CONVERTED).toEqual([]);
    expect(PICKUP_TRANSITIONS.REJECTED).toEqual([]);
    expect(PICKUP_TRANSITIONS.CANCELED).toEqual([]);
  });
});

describe("isTerminalStatus", () => {
  it("returns true for terminal statuses", () => {
    expect(isTerminalStatus("CONVERTED")).toBe(true);
    expect(isTerminalStatus("REJECTED")).toBe(true);
    expect(isTerminalStatus("CANCELED")).toBe(true);
  });

  it("returns false for active statuses", () => {
    expect(isTerminalStatus("PENDING")).toBe(false);
    expect(isTerminalStatus("ACCEPTED")).toBe(false);
    expect(isTerminalStatus("SCHEDULED")).toBe(false);
  });
});

describe("canTransition", () => {
  const validCases: Array<[PickupRequestStatus, PickupRequestStatus]> = [
    ["PENDING", "ACCEPTED"],
    ["PENDING", "REJECTED"],
    ["PENDING", "CANCELED"],
    ["ACCEPTED", "SCHEDULED"],
    ["ACCEPTED", "REJECTED"],
    ["ACCEPTED", "CANCELED"],
    ["SCHEDULED", "CONVERTED"],
    ["SCHEDULED", "CANCELED"],
  ];

  for (const [from, to] of validCases) {
    it(`allows ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(true);
    });
  }

  const invalidCases: Array<[PickupRequestStatus, PickupRequestStatus]> = [
    // Cannot skip states
    ["PENDING", "SCHEDULED"],
    ["PENDING", "CONVERTED"],
    ["ACCEPTED", "CONVERTED"],
    // Cannot go backwards
    ["ACCEPTED", "PENDING"],
    ["SCHEDULED", "ACCEPTED"],
    ["SCHEDULED", "PENDING"],
    // Cannot reject once scheduled (must cancel)
    ["SCHEDULED", "REJECTED"],
    // Cannot leave terminal states
    ["CONVERTED", "PENDING"],
    ["REJECTED", "PENDING"],
    ["CANCELED", "PENDING"],
    ["CONVERTED", "CANCELED"],
  ];

  for (const [from, to] of invalidCases) {
    it(`rejects ${from} → ${to}`, () => {
      expect(canTransition(from, to)).toBe(false);
    });
  }
});

describe("assertCanTransition", () => {
  it("does not throw for a valid transition", () => {
    expect(() => assertCanTransition("PENDING", "ACCEPTED")).not.toThrow();
    expect(() => assertCanTransition("SCHEDULED", "CONVERTED")).not.toThrow();
  });

  it("throws InvalidPickupTransition for invalid transitions", () => {
    expect(() => assertCanTransition("PENDING", "CONVERTED")).toThrow(
      InvalidPickupTransition,
    );
    expect(() => assertCanTransition("CONVERTED", "PENDING")).toThrow(
      InvalidPickupTransition,
    );
  });

  it("includes from/to on the error for debugging", () => {
    try {
      assertCanTransition("ACCEPTED", "CONVERTED");
      throw new Error("should have thrown");
    } catch (e) {
      const err = e as InvalidPickupTransition;
      expect(err.from).toBe("ACCEPTED");
      expect(err.to).toBe("CONVERTED");
      expect(err.message).toContain("ACCEPTED");
      expect(err.message).toContain("CONVERTED");
    }
  });
});
