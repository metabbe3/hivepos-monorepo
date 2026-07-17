import { encode } from "@auth/core/jwt";
import bcrypt from "bcrypt";
import { z } from "zod";
import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  UnauthenticatedError,
  ForbiddenError,
} from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { authSecret, loadRoleContext } from "@/lib/auth";
import { resolveAllFlagsSafe } from "@/lib/feature-flags";
import { getRequestIp, rateLimitByIp } from "@/lib/rate-limit";

/**
 * Mobile / programmatic login.
 *
 * Returns the NextAuth session JWT in the body so a native client (Flutter) can
 * store one string and send it as `Authorization: Bearer <token>` on every
 * other request. The token is byte-compatible with the web session cookie
 * (`getApiSession` decodes it via the same salt + secret), so no other route
 * needs to know how the client authenticated.
 *
 * We replicate `authorize()` + the `jwt` callback claim assembly here rather
 * than calling NextAuth, because NextAuth's credentials flow is browser-shaped
 * (CSRF token + form-POST + Set-Cookie) and traps `authorize` inside the
 * provider closure. The verification logic mirrors `lib/auth.ts` 1:1.
 */
const SESSION_MAX_AGE_SECONDS = 8 * 60 * 60; // matches NextAuth session.maxAge
const SESSION_SALT = "authjs.session-token";

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // "super-admin" → authenticate against the SuperAdmin table (platform staff),
  // mirroring the scope gate in authorize().
  scope: z.enum(["super-admin"]).optional(),
});

interface AuthClaims {
  sub: string;
  name: string | null;
  email: string;
  role: string;
  tenantId: string | null;
  branchId: string | null;
  branchName: string;
  tenantName: string;
  tenantSlug: string | null;
  activeModules: string[];
  activeModule: string;
  sessionVersion: number;
  permissions: string[];
  roleId?: string;
  roleName?: string;
  featureFlags?: Record<string, boolean>;
}

function publicUser(c: AuthClaims) {
  return {
    id: c.sub,
    email: c.email,
    name: c.name,
    role: c.role,
    tenantId: c.tenantId,
    tenantName: c.tenantName,
    tenantSlug: c.tenantSlug,
    branchId: c.branchId,
    branchName: c.branchName,
    activeModule: c.activeModule,
    activeModules: c.activeModules,
    permissions: c.permissions,
    roleId: c.roleId,
    roleName: c.roleName,
    sessionVersion: c.sessionVersion,
    featureFlags: c.featureFlags,
  };
}

async function issueToken(claims: AuthClaims): Promise<string> {
  return encode({
    salt: SESSION_SALT,
    secret: authSecret,
    token: claims,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export const POST = withErrorHandler(async (req: Request) => {
  // Same IP rate limit as authorize(): 10 attempts/min. Throws RateLimitError → 429.
  if (process.env.RATE_LIMIT_DISABLED !== "true") {
    const ip = await getRequestIp();
    rateLimitByIp(ip, "/api/auth/login", { limit: 10, windowSeconds: 60 });
  }

  const { email, password, scope } = await parseBody(req, loginBody);

  // ── Super-admin login ──
  if (scope === "super-admin") {
    const admin = await prisma.superAdmin.findUnique({ where: { email } });
    if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
      throw new UnauthenticatedError("Invalid email or password");
    }
    const claims: AuthClaims = {
      sub: admin.id,
      name: admin.name,
      email: admin.email,
      role: "SUPER_ADMIN",
      tenantId: null,
      branchId: null,
      branchName: "",
      tenantName: "",
      tenantSlug: null,
      activeModules: ["laundry"],
      activeModule: "laundry",
      sessionVersion: 0,
      permissions: ["*"],
      roleName: "Super Admin",
    };
    const token = await issueToken(claims);
    return apiSuccess({
      token,
      expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
      user: publicUser(claims),
    });
  }

  // ── Tenant user login ──
  // Reject silently if this email belongs to a platform super-admin — they must
  // use scope:"super-admin" (or the /super-admin/login page). Mirrors authorize().
  const isSuperAdminEmail = await prisma.superAdmin.findUnique({
    where: { email },
  });
  if (isSuperAdminEmail) {
    throw new UnauthenticatedError("Invalid email or password");
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { tenant: true, branch: true },
  });

  // Generic 401 on any miss to avoid user enumeration.
  if (!user || !user.isActive) {
    throw new UnauthenticatedError("Invalid email or password");
  }

  // Tenant-state gates. Web flow lets pending users through to redirect; for an
  // API client we reject with a clear message so Flutter can route to a
  // "pending approval" / "suspended" screen instead of looping on 401.
  if (!user.tenant?.approvedAt) {
    throw new ForbiddenError("Account pending approval");
  }
  if (!user.tenant?.isActive) {
    throw new ForbiddenError("Account suspended");
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    throw new UnauthenticatedError("Invalid email or password");
  }

  // Fire-and-forget lastLoginAt stamp (enables Google OAuth auto-link later).
  prisma.user
    .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
    .catch(() => undefined);

  const roleCtx = await loadRoleContext(user.id, user.role);
  const activeModules = user.tenant.activeModules ?? ["laundry"];
  const claims: AuthClaims = {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    branchId: user.branchId,
    branchName: user.branch?.name ?? "",
    tenantName: user.tenant.name,
    tenantSlug: user.tenant.slug,
    activeModules,
    activeModule: activeModules[0] ?? "laundry",
    sessionVersion: user.sessionVersion,
    permissions: roleCtx.permissions,
    roleId: roleCtx.roleId,
    roleName: roleCtx.roleName,
    featureFlags: await resolveAllFlagsSafe(user.tenantId),
  };

  const token = await issueToken(claims);
  return apiSuccess({
    token,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
    user: publicUser(claims),
  });
});
