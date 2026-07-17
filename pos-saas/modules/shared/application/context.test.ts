import { describe, it, expect } from "vitest";
import {
  hasPermission,
  type TenantRequestContext,
} from "./context";

function ctx(permissions: string[]): TenantRequestContext {
  return { userId: "u1", tenantId: "t1", permissions };
}

describe("hasPermission (context)", () => {
  it("returns true when the exact permission string is present", () => {
    expect(hasPermission(ctx(["users:read"]), "users", "read")).toBe(true);
  });

  it("returns false when the exact permission string is missing", () => {
    expect(hasPermission(ctx(["users:read"]), "users", "delete")).toBe(false);
  });

  it("returns true for any resource:action when the wildcard is present", () => {
    expect(hasPermission(ctx(["*"]), "orders", "create")).toBe(true);
    expect(hasPermission(ctx(["*"]), "billing", "read")).toBe(true);
  });

  it("does not match partial permission strings (users:read ≠ users:readwrite)", () => {
    expect(hasPermission(ctx(["users:readwrite"]), "users", "read")).toBe(false);
  });

  it("returns false when permissions list is empty", () => {
    expect(hasPermission(ctx([]), "users", "read")).toBe(false);
  });

  it("works with arbitrary string resource/action pairs (callers may use names outside the typed union)", () => {
    expect(hasPermission(ctx(["customResource:customAction"]), "customResource", "customAction")).toBe(true);
  });
});
