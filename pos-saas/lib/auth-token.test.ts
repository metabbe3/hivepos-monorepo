import { describe, it, expect } from "vitest";
import { encode, decode } from "@auth/core/jwt";

/**
 * Guards the token contract used by `POST /api/auth/login` (app/api/auth/login/route.ts).
 *
 * The login route signs claims with `encode()` using salt "authjs.session-token"
 * + authSecret, and `getApiSession()` reads bearer tokens back with the matching
 * `decode()`. This proves that round-trip preserves every claim and sets the
 * 8h expiry — the #1 risk being a wrong salt/secret/claim shape that would make
 * every authenticated mobile request 401.
 */

// Mirrors lib/auth.ts authSecret + the login route's salt/maxAge exactly.
const SECRET =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  "dev-secret-change-in-production";
const SALT = "authjs.session-token";
const MAX_AGE = 8 * 60 * 60;

describe("login token format (POST /api/auth/login)", () => {
  it("encode→decode round-trips every claim and sets exp = iat + 8h", async () => {
    const claims = {
      sub: "user-123",
      name: "Demo Owner",
      email: "owner@example.com",
      role: "OWNER",
      tenantId: "tenant-1",
      branchId: "branch-1",
      branchName: "Main",
      tenantName: "Berkah Laundry",
      tenantSlug: "berkah",
      activeModules: ["laundry", "fnb"],
      activeModule: "laundry",
      sessionVersion: 3,
      permissions: ["orders:read", "orders:create"],
      roleId: "role-1",
      roleName: "Owner",
      featureFlags: { inventory: true },
    };

    const token = await encode({
      salt: SALT,
      secret: SECRET,
      token: claims,
      maxAge: MAX_AGE,
    });

    expect(typeof token).toBe("string");
    expect(token.length).toBeGreaterThan(0);

    const decoded = (await decode({
      salt: SALT,
      secret: SECRET,
      token,
    })) as Record<string, unknown>;

    // getApiSession reads exactly these claims off the bearer token.
    expect(decoded).toBeTruthy();
    expect(decoded.sub).toBe(claims.sub);
    expect(decoded.email).toBe(claims.email);
    expect(decoded.role).toBe("OWNER");
    expect(decoded.tenantId).toBe("tenant-1");
    expect(decoded.tenantSlug).toBe("berkah");
    expect(decoded.branchId).toBe("branch-1");
    expect(decoded.activeModule).toBe("laundry");
    expect(decoded.activeModules).toEqual(["laundry", "fnb"]);
    expect(decoded.sessionVersion).toBe(3);
    expect(decoded.permissions).toEqual(claims.permissions);
    expect(decoded.roleId).toBe("role-1");
    expect(decoded.roleName).toBe("Owner");
    expect(decoded.featureFlags).toEqual({ inventory: true });

    // encode stamps iat/exp from maxAge; the lifetime must be exactly 8h.
    expect(typeof decoded.iat).toBe("number");
    expect(typeof decoded.exp).toBe("number");
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(MAX_AGE);
  });

  // decode() THROWS on a wrong secret (JWE decryption fails) — getApiSession()
  // wraps it in try/catch → null → 401. Asserting the throw documents why that
  // catch exists and guards the tamper path.
  it("throws under a different secret (tamper protection)", async () => {
    const token = await encode({
      salt: SALT,
      secret: SECRET,
      token: { sub: "x" },
      maxAge: MAX_AGE,
    });
    await expect(
      decode({ salt: SALT, secret: "wrong-secret", token }),
    ).rejects.toThrow();
  });
});
