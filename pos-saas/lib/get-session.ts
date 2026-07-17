import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { decode } from "@auth/core/jwt";
import { authSecret } from "@/lib/auth";
import type { UserRole } from "@/app/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | string;
  branchId: string;
  branchName: string;
  tenantId: string;
  tenantName: string;
  activeModule: string;
  activeModules: string[];
  /** RBAC permission strings from the user's Role. */
  permissions: string[];
  /** RBAC role id (FK to Role), or null/undefined when not assigned. */
  roleId?: string;
  /** RBAC role display name. */
  roleName?: string;
  /** Resolved feature flags for this tenant (key → enabled). */
  featureFlags?: Record<string, boolean>;
}

export interface ApiSession {
  user: SessionUser;
}

/**
 * Get the current session from cookie (NextAuth) or Bearer token.
 * Use this instead of `auth()` in API routes that need to support mobile clients.
 * Enforces single-session: checks sessionVersion for Bearer tokens.
 */
export async function getApiSession(): Promise<ApiSession | null> {
  // Try cookie-based session first (NextAuth handles sessionVersion in jwt callback)
  const session = await auth();
  // ponytail: trust boundary — require user.id plus either tenantId or a
  // SUPER_ADMIN role. Super-admin sessions carry tenantId:null (platform-level,
  // not tenant-scoped) so the role check lets them through. Tenant users still
  // need tenantId — without it, null flows into Prisma where clauses and causes
  // opaque 500s across every authenticated API. The middleware only checks
  // cookie presence, so this is the right place to enforce completeness.
  if (
    session?.user?.id &&
    (session.user.tenantId || session.user.role === "SUPER_ADMIN")
  ) {
    return session as any as ApiSession;
  }

  // Fallback: Bearer token from Authorization header
  const hdrs = await headers();
  const authHeader = hdrs.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  try {
    const payload = await decode({
      salt: "authjs.session-token",
      secret: authSecret,
      token,
    });
    if (!payload?.sub) return null;

    // Single-session enforcement: check sessionVersion
    const p = payload as Record<string, unknown>;
    const tokenVersion = p.sessionVersion as number | undefined;
    if (tokenVersion !== undefined) {
      // ponytail: SUPER_ADMIN tokens store against SuperAdmin, tenant users against User.
      const isSuperAdmin = p.role === "SUPER_ADMIN";
      const dbRow = isSuperAdmin
        ? await prisma.superAdmin.findUnique({
            where: { id: payload.sub },
            select: { sessionVersion: true },
          })
        : await prisma.user.findUnique({
            where: { id: payload.sub },
            select: { sessionVersion: true },
          });
      if (!dbRow || dbRow.sessionVersion !== tokenVersion) {
        return null; // Session invalidated by newer login / revoke-sessions
      }
    }

    return {
      user: {
        id: payload.sub,
        name: (payload.name as string) ?? "",
        email: (p.email as string) ?? "",
        role: (p.role as UserRole) ?? "EMPLOYEE",
        branchId: (p.branchId as string) ?? "",
        branchName: (p.branchName as string) ?? "",
        tenantId: (p.tenantId as string) ?? "",
        tenantName: (p.tenantName as string) ?? "",
        activeModule: (p.activeModule as string) ?? "laundry",
        activeModules: (p.activeModules as string[]) ?? ["laundry"],
        permissions: (p.permissions as string[]) ?? [],
        roleId: (p.roleId as string) ?? undefined,
        roleName: (p.roleName as string) ?? undefined,
        featureFlags: (p.featureFlags as Record<string, boolean> | undefined),
      },
    };
  } catch {
    return null;
  }
}
