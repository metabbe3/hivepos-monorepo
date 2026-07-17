import { describe, it, expect, vi, beforeEach } from "vitest";

// ponytail: only the cookie-session branch of getApiSession is exercised —
// the super-admin fix lives there. Bearer-token branch needs a JWT decode
// + Prisma round-trip; out of scope for this regression.

const authMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: () => authMock(),
  authSecret: "test-secret",
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import { getApiSession } from "./get-session";

describe("getApiSession — cookie session gate", () => {
  beforeEach(() => {
    authMock.mockReset();
  });

  it("returns session for tenant user with tenantId", async () => {
    authMock.mockResolvedValue({
      user: { id: "u1", tenantId: "t1", role: "OWNER" },
    });
    const session = await getApiSession();
    expect(session?.user?.id).toBe("u1");
  });

  it("returns session for SUPER_ADMIN even when tenantId is null", async () => {
    authMock.mockResolvedValue({
      user: { id: "sa1", tenantId: null, role: "SUPER_ADMIN" },
    });
    const session = await getApiSession();
    expect(session?.user?.id).toBe("sa1");
  });

  it("returns null for non-super-admin with null tenantId (partial session)", async () => {
    authMock.mockResolvedValue({
      user: { id: "u2", tenantId: null, role: "EMPLOYEE" },
    });
    const session = await getApiSession();
    expect(session).toBeNull();
  });
});
