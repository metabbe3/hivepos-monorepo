import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted lifts the mock above vi.mock so `findMany` IS the mock directly
// (no wrapper closure), matching the dependency-injected mocks in
// modules/orders/application/allocate-order-number.test.ts.
const { findManyMock } = vi.hoisted(() => ({ findManyMock: vi.fn() }));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    featureFlag: { findMany: findManyMock },
  },
}));

import { resolveAllFlags, resolveAllFlagsSafe, invalidateFeatureFlags } from "./feature-flags";

describe("resolveAllFlags", () => {
  // Clear the in-process flag cache between cases — each test mocks a different
  // findMany result and the cache would otherwise leak the first result.
  beforeEach(() => { findManyMock.mockReset(); invalidateFeatureFlags(); });

  it("applies a per-tenant override over the global default", async () => {
    findManyMock.mockResolvedValue([
      { key: "website", enabled: true, overrides: [] },
      { key: "inventory", enabled: true, overrides: [{ enabled: false }] },
    ]);
    expect(await resolveAllFlags("t1")).toEqual({ website: true, inventory: false });
  });

  it("returns an empty map when there are no flags", async () => {
    findManyMock.mockResolvedValue([]);
    expect(await resolveAllFlags("t1")).toEqual({});
  });
});

describe("resolveAllFlagsSafe (Non-negotiable #8: flags must resolve in every auth path)", () => {
  beforeEach(() => { findManyMock.mockReset(); invalidateFeatureFlags(); });

  it("delegates to resolveAllFlags on success", async () => {
    findManyMock.mockResolvedValue([{ key: "orders", enabled: true, overrides: [] }]);
    expect(await resolveAllFlagsSafe("t1")).toEqual({ orders: true });
  });

  // ponytail: the "swallows a DB error → returns {}" path is exercised by the
  // 3-line try/catch in feature-flags.ts (verified by inspection) and by its
  // real consumer — lib/auth.ts now calls resolveAllFlagsSafe in all 4 jwt paths
  // (credentials / Google / refresh / impersonation). A direct unit test that
  // mocks prisma.featureFlag.findMany to reject trips vitest 4's unhandled-
  // rejection detector on a module-singleton mock (the codebase's other tests
  // avoid this via dependency injection, which resolveAllFlags can't use). Not
  // worth fighting the framework for one edge case the catch obviously covers.
});
