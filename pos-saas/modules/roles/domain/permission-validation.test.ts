import { describe, it, expect } from "vitest";
import { validatePermissions, isOwnerRole } from "./permission-validation";
import { WILDCARD } from "@/lib/permissions/definitions";

describe("validatePermissions", () => {
  it("accepts known permission strings for a custom role", () => {
    const result = validatePermissions(
      ["orders:read", "orders:create", "customers:read"],
      false,
    );
    expect(result.valid).toBe(true);
  });

  it("rejects unknown permission strings", () => {
    const result = validatePermissions(["orders:read", "unknown:action"], false);
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid permission string");
  });

  it("rejects wildcard for non-owner roles", () => {
    const result = validatePermissions([WILDCARD], false);
    expect(result.valid).toBe(false);
    expect(result.error).toContain("reserved for the Owner role");
  });

  it("allows wildcard for the Owner role", () => {
    const result = validatePermissions([WILDCARD], true);
    expect(result.valid).toBe(true);
  });

  it("allows wildcard mixed with other permissions for Owner role", () => {
    const result = validatePermissions([WILDCARD, "orders:read"], true);
    expect(result.valid).toBe(true);
  });

  it("accepts an empty permission array", () => {
    const result = validatePermissions([], false);
    expect(result.valid).toBe(true);
  });
});

describe("isOwnerRole", () => {
  it("returns true when permissions include wildcard", () => {
    expect(isOwnerRole([WILDCARD])).toBe(true);
  });

  it("returns false for normal permissions", () => {
    expect(isOwnerRole(["orders:read", "customers:read"])).toBe(false);
  });

  it("returns false for empty permissions", () => {
    expect(isOwnerRole([])).toBe(false);
  });
});
