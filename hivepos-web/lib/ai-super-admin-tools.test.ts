import { describe, it, expect } from "vitest";
import {
  executeSuperAdminTool,
  executeSuperAdminDatabaseQuery,
  stripExcludedFields,
} from "./ai-super-admin-tools";

// Security boundary for the AI query tool: it must be READ-ONLY and PLATFORM-ONLY.
// These validation paths return an error JSON before any Prisma call, so no DB is needed.

function errOf(json: string): string {
  return (JSON.parse(json).error as string) ?? "";
}

describe("executeSuperAdminDatabaseQuery — model allowlist (platform-only)", () => {
  it("rejects tenant-data models (order/customer/payment)", async () => {
    for (const model of ["order", "customer", "payment", "expense"]) {
      const res = await executeSuperAdminDatabaseQuery({ model, operation: "count" });
      expect(errOf(res)).toMatch(/not allowed/i);
    }
  });

  it("rejects the operator-credentials model (superAdminUser)", async () => {
    const res = await executeSuperAdminDatabaseQuery({ model: "superAdminUser", operation: "count" });
    expect(errOf(res)).toMatch(/not allowed/i);
  });

  it("rejects unknown models", async () => {
    const res = await executeSuperAdminDatabaseQuery({ model: "nonsense", operation: "count" });
    expect(errOf(res)).toMatch(/not allowed/i);
  });
});

describe("executeSuperAdminDatabaseQuery — read-only operations", () => {
  it("rejects every write operation on an allowed model", async () => {
    const writes = ["create", "update", "updateMany", "delete", "deleteMany", "upsert"];
    for (const operation of writes) {
      // Cast: these ops are deliberately outside the typed union — we're asserting
      // runtime rejection of type-disallowed (write) operations.
      const res = await executeSuperAdminDatabaseQuery({ model: "tenant", operation: operation as never });
      expect(errOf(res)).toMatch(/not allowed/i);
    }
  });

  it("rejects groupBy without a `by` field before touching the DB", async () => {
    const res = await executeSuperAdminDatabaseQuery({ model: "tenant", operation: "groupBy" });
    expect(errOf(res)).toMatch(/groupBy requires/i);
  });
});

describe("executeSuperAdminTool — routing", () => {
  it("returns an error (never throws, never queries) for unknown tools", async () => {
    const res = await executeSuperAdminTool("drop_everything", {});
    expect(errOf(res)).toMatch(/unknown tool/i);
  });
});

describe("stripExcludedFields — credential leak prevention", () => {
  const USER_SECRET = ["passwordHash", "sessionVersion", "googleId"];

  it("strips credential columns from a findMany without a select", () => {
    const rows = [
      { id: "1", email: "a@b.c", passwordHash: "xxx", sessionVersion: 0, googleId: "g" },
    ];
    const out = stripExcludedFields(rows, USER_SECRET) as Array<Record<string, unknown>>;
    expect(out[0].email).toBe("a@b.c");
    expect(out[0].passwordHash).toBeUndefined();
    expect(out[0].sessionVersion).toBeUndefined();
    expect(out[0].googleId).toBeUndefined();
  });

  it("strips a credential used as a groupBy key", () => {
    const grouped = [
      { passwordHash: "h1", _count: 3 },
      { passwordHash: "h2", _count: 1 },
    ];
    const out = stripExcludedFields(grouped, USER_SECRET) as Array<Record<string, unknown>>;
    expect(out.every((r) => r.passwordHash === undefined)).toBe(true);
    expect(out[0]._count).toBe(3);
  });
});
