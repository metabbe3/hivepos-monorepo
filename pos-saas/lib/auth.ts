import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import bcrypt from "bcrypt";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { z } from "zod";
import { legacyRoleToDefaultName } from "./permissions/defaults";
import { getRequestIp, rateLimitByIp } from "./rate-limit";
import { resolveAllFlagsSafe } from "./feature-flags";

export const authSecret =
  process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "dev-secret-change-in-production";

// ─── Google account linking (profile-initiated) ───
// ponytail: HMAC-signed cookie carries the authenticated userId from
// /api/user/profile/oauth-link/start through OAuth to the signIn callback.
// Bridge of trust between "I'm logged in now" and "OAuth callback later".
// Ceiling: single-use, 5-min expiry (set by start route), HttpOnly+SameSite.
// Upgrade: signed JWT with expiry claim if we ever need non-default TTLs.

export const LINK_COOKIE = "google-link-pending";

export function signLinkToken(userId: string): string {
  const mac = createHmac("sha256", authSecret).update(userId).digest("hex");
  return `${userId}.${mac}`;
}

export function verifyLinkToken(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const userId = token.slice(0, dot);
  const mac = token.slice(dot + 1);
  const expected = createHmac("sha256", authSecret).update(userId).digest();
  const got = Buffer.from(mac, "hex");
  if (got.length !== expected.length) return null;
  if (!timingSafeEqual(got, expected)) return null;
  return userId;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  // ponytail: scope gates which user table authorize checks. "super-admin" → SuperAdmin table only.
  // absent → User table only, and super-admin emails are silently rejected so they're forced to /super-admin/login.
  scope: z.enum(["super-admin"]).optional(),
  // remember-me: when false the jwt callback caps the session at 8h (else 30d).
  // NextAuth form-encodes credentials, so this arrives as "true"/"false" string.
  remember: z.any().optional(),
});

/**
 * Resolve RBAC permissions/roleName for a user.
 * Falls back to the matching default role by legacy enum when no roleId is set.
 */
export async function loadRoleContext(userId: string, legacyRole: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roleId: true,
      roleRef: { select: { id: true, name: true, permissions: true } },
    },
  });

  if (user?.roleRef) {
    return {
      roleId: user.roleRef.id,
      roleName: user.roleRef.name,
      permissions: user.roleRef.permissions,
    };
  }

  // Fallback: look up the default role that matches the legacy enum
  const fallbackName = legacyRoleToDefaultName(legacyRole as "OWNER" | "MANAGER" | "EMPLOYEE");
  const tenantId = await prisma.user
    .findUnique({ where: { id: userId }, select: { tenantId: true } })
    .then((u) => u?.tenantId);
  if (tenantId) {
    const fallbackRole = await prisma.role.findFirst({
      where: { tenantId, name: fallbackName },
      select: { id: true, name: true, permissions: true },
    });
    if (fallbackRole) {
      return {
        roleId: fallbackRole.id,
        roleName: fallbackRole.name,
        permissions: fallbackRole.permissions,
      };
    }
  }

  // Safety net: OWNER legacy role always gets wildcard.
  // Prevents lockout when RBAC roles haven't been seeded yet.
  if (legacyRole === "OWNER") {
    return { roleId: undefined, roleName: "Owner", permissions: ["*"] };
  }
  return { roleId: undefined, roleName: undefined, permissions: [] as string[] };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 30 * 24 * 60 * 60 }, // 30 days (remember-me default)
  secret: authSecret,
  // ponytail: Cloudflare Tunnel is non-Vercel — Auth.js v5 only auto-trusts
  // host on Vercel. Without this, every OAuth callback throws Configuration.
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        // ponytail: scope isn't a UI field but NextAuth drops undeclared keys.
        // Declaring it lets /super-admin/login pass scope:"super-admin" through to authorize.
        scope: { label: "Scope", type: "text" },
        remember: { label: "Remember", type: "text" },
      },
      async authorize(credentials) {
        // ponytail: rate-limit by client IP — 10 credential attempts per minute.
        // Throws RateLimitError; NextAuth wraps any authorize throw into auth-failure.
        // Bypass with RATE_LIMIT_DISABLED=true (dev/test containers running sweeps).
        if (process.env.RATE_LIMIT_DISABLED !== "true") {
          const ip = await getRequestIp();
          rateLimitByIp(ip, "/api/auth/callback/credentials", {
            limit: 10,
            windowSeconds: 60,
          });
        }

        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, scope, remember } = parsed.data;
        const rememberBool = remember === true || remember === "true";

        // Super-admin branch: only entered when scope === "super-admin" (set by /super-admin/login).
        if (scope === "super-admin") {
          const superAdmin = await prisma.superAdmin.findUnique({
            where: { email },
          });
          if (superAdmin) {
            const valid = await bcrypt.compare(password, superAdmin.passwordHash);
            if (valid) {
              return {
                id: superAdmin.id,
                email: superAdmin.email,
                name: superAdmin.name,
                role: "SUPER_ADMIN",
                tenantId: null,
                branchId: null,
                sessionVersion: 0,
                permissions: ["*"],
                roleId: undefined,
                roleName: "Super Admin",
                remember: rememberBool,
              } as any;
            }
          }
          return null;
        }

        // Tenant login branch: if this email matches a SuperAdmin row, reject silently.
        // Super-admins must use /super-admin/login.
        const existingSuperAdmin = await prisma.superAdmin.findUnique({
          where: { email },
        });
        if (existingSuperAdmin) return null;

        // Check tenant user
        const user = await prisma.user.findUnique({
          where: { email },
          include: { tenant: true, branch: true },
        });

        if (!user || !user.isActive) return null;
        // ponytail: pending tenants (isActive=false, approvedAt=null) pass through so
        // the signIn callback can redirect to /login?error=pending-approval. Suspended
        // tenants (approvedAt !== null but isActive=false) still reject here.
        if (!user.tenant?.isActive && user.tenant?.approvedAt) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        // ponytail: stamp lastLoginAt so Google OAuth auto-link can later verify
        // this account is actively used by someone who knows the password.
        // Fire-and-forget; don't block login on this write.
        prisma.user
          .update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => undefined);

        const roleCtx = await loadRoleContext(user.id, user.role);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          branchId: user.branchId,
          branchName: user.branch?.name ?? "",
          tenantName: user.tenant.name,
          tenantSlug: user.tenant.slug,
          activeModules: user.tenant.activeModules ?? ["laundry"],
          sessionVersion: user.sessionVersion,
          permissions: roleCtx.permissions,
          roleId: roleCtx.roleId,
          roleName: roleCtx.roleName,
          // ponytail: signIn callback reads this to redirect pending users to /login?error=pending-approval.
          tenantApprovedAt: user.tenant?.approvedAt ?? null,
          onboardingCompletedAt: user.tenant?.onboardingCompletedAt?.toISOString() ?? null,
          isDemo: user.tenant?.isDemo ?? false,
          remember: rememberBool,
        } as any;
      },
    }),

    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          Google({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),
  ],
  callbacks: {
    // ─── Google OAuth: account linking + new user redirect ───
    async signIn({ user, account }) {
      // ponytail: gate credentials login for pending tenants. Redirect beats
      // returning false (generic Auth.js page) — login page shows actionable banner.
      // Skip for SUPER_ADMIN — they have no tenant.
      if (account?.provider === "credentials") {
        const isSuperAdmin = (user as any).role === "SUPER_ADMIN";
        const approvedAt = (user as any).tenantApprovedAt;
        if (!isSuperAdmin && !approvedAt) return "/login?error=pending-approval";
      }

      if (account?.provider !== "google") return true;

      const googleId = account.providerAccountId;
      const email = user.email;
      if (!email) return false;

      // 0. Profile-initiated link flow: HMAC-signed cookie proves the user
      // was authenticated when they clicked "Link Google" on /profile.
      // Trust established → bypass the emailVerified check below.
      const jar = await cookies();
      const linkToken = jar.get(LINK_COOKIE)?.value;
      if (linkToken) {
        const linkUserId = verifyLinkToken(linkToken);
        jar.delete(LINK_COOKIE);
        if (linkUserId) {
          // Refuse if this googleId already belongs to a different user.
          const dupe = await prisma.user.findFirst({
            where: { googleId },
            select: { id: true },
          });
          if (dupe && dupe.id !== linkUserId) return false;
          await prisma.user.update({
            where: { id: linkUserId },
            data: {
              googleId,
              avatar: user.image ?? null,
              emailVerified: new Date(),
            },
          });
          return true;
        }
      }

      // 1. Already linked? → allow
      const byGoogle = await prisma.user.findFirst({
        where: { googleId },
        include: { tenant: true },
      });
      if (byGoogle) {
        return byGoogle.isActive && byGoogle.tenant?.isActive;
      }

      // 2. Email match? → auto-link accounts
      const byEmail = await prisma.user.findUnique({
        where: { email },
        include: { tenant: true },
      });
      if (byEmail) {
        if (!byEmail.isActive || !byEmail.tenant?.isActive) return false;
        // ponytail: allow auto-link only if the existing credential account has
        // been used at least once. Blocks the "pre-create victim email then
        // hijack OAuth" takeover while preserving the legitimate "owner created
        // the email first" flow. emailVerified stays as a future slot when a
        // verification flow is wired; nothing depends on it today.
        // Redirect with a specific error code so /login can surface a clear
        // message instead of the generic Auth.js "Access Denied" page.
        if (!byEmail.lastLoginAt) {
          const params = new URLSearchParams({ error: "google-link-required" });
          return `/login?${params.toString()}`;
        }
        await prisma.user.update({
          where: { id: byEmail.id },
          data: { googleId, avatar: user.image ?? null },
        });
        return true;
      }

      // 3. New user → redirect to register with pre-filled data
      const params = new URLSearchParams({
        googleEmail: email,
        googleName: user.name ?? "",
        googleId,
      });
      return `/register?${params.toString()}`;
    },

    async jwt({ token, user, account, trigger, session: updateSession }) {
      // ─── Credentials provider: enrich from user object ───
      if (user && account?.provider !== "google") {
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.branchId = (user as any).branchId;
        token.branchName = (user as any).branchName;
        token.tenantName = (user as any).tenantName;
        token.tenantSlug = (user as any).tenantSlug;
        token.onboardingCompletedAt = (user as any).onboardingCompletedAt ?? null;
        token.isDemo = (user as any).isDemo ?? false;
        const mods: string[] = (user as any).activeModules ?? ["laundry"];
        token.activeModules = mods;
        token.activeModule = mods[0] ?? "laundry";
        token.sessionVersion = (user as any).sessionVersion ?? 0;
        token.permissions = (user as any).permissions ?? [];
        token.roleId = (user as any).roleId;
        token.roleName = (user as any).roleName;
        // ponytail: resolve feature flags once at login. Refresh path below
        // re-resolves when super-admin toggles + tenant sessionVersion bumps.
        if (token.tenantId) {
          token.featureFlags = await resolveAllFlagsSafe(token.tenantId as string);
        }
        // Remember-me: when unchecked, the expiry check below caps the session at 8h.
        token.remember = (user as any).remember !== false;
        token.sessionStartedAt = token.sessionStartedAt ?? Date.now();
      }

      // ─── Google OAuth: enrich from DB (user object only has Google data) ───
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findFirst({
          where: { googleId: account.providerAccountId },
          include: { tenant: true, branch: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.tenantId = dbUser.tenantId;
          token.branchId = dbUser.branchId;
          token.branchName = dbUser.branch?.name ?? "";
          token.tenantName = dbUser.tenant.name;
          token.tenantSlug = dbUser.tenant.slug;
          token.onboardingCompletedAt = dbUser.tenant.onboardingCompletedAt?.toISOString() ?? null;
          token.isDemo = dbUser.tenant.isDemo;
          const mods: string[] = dbUser.tenant.activeModules ?? ["laundry"];
          token.activeModules = mods;
          token.activeModule = mods[0] ?? "laundry";
          token.sessionVersion = dbUser.sessionVersion;

          const roleCtx = await loadRoleContext(dbUser.id, dbUser.role);
          token.permissions = roleCtx.permissions;
          token.roleId = roleCtx.roleId;
          token.roleName = roleCtx.roleName;
          if (token.tenantId) {
            token.featureFlags = await resolveAllFlagsSafe(token.tenantId as string);
          }
        }
      }

      // ─── Session update: persist branch / module switches to JWT ───
      if (trigger === "update" && updateSession) {
        if (updateSession.selectedBranchId) {
          token.branchId = updateSession.selectedBranchId;
        }
        if (updateSession.selectedBranchName !== undefined) {
          token.branchName = updateSession.selectedBranchName;
        }
        if (updateSession.selectedModule) {
          // Only allow switching to a module the tenant has enabled
          const allowed = ((token as any).activeModules as string[] | undefined) ?? ["laundry"];
          if (allowed.includes(updateSession.selectedModule)) {
            token.activeModule = updateSession.selectedModule;
          }
        }

        // ─── Live permission refresh: when the client signals a version
        // bump or an explicit refreshPermissions flag, reload from DB so
        // edited role permissions take effect without a re-login. ───
        const userId = token.sub;
        const wantRefresh =
          (updateSession as any).refreshPermissions === true ||
          typeof (updateSession as any).sessionVersion === "number";
        if (userId && wantRefresh) {
          const legacy = (token.role as string) ?? "EMPLOYEE";
          const roleCtx = await loadRoleContext(userId, legacy);
          token.permissions = roleCtx.permissions;
          token.roleId = roleCtx.roleId;
          token.roleName = roleCtx.roleName;
          // Also refresh sessionVersion so future bearer-token checks stay aligned.
          const fresh = await prisma.user.findUnique({
            where: { id: userId },
            select: { sessionVersion: true },
          });
          if (fresh) token.sessionVersion = fresh.sessionVersion;
          // Refresh feature flags too so super-admin toggles propagate.
          if (token.tenantId) {
            token.featureFlags = await resolveAllFlagsSafe(token.tenantId as string);
          }
        }

        // ─── Onboarding refresh: after the owner finishes/skips the wizard, the
        // /onboarding page calls update({ refreshOnboarding: true }) to pull the
        // new timestamp into the JWT so /dashboard stops redirecting back. ───
        if ((updateSession as any).refreshOnboarding === true && token.tenantId) {
          const ob = await prisma.tenant.findUnique({
            where: { id: token.tenantId as string },
            select: { onboardingCompletedAt: true },
          });
          token.onboardingCompletedAt = ob?.onboardingCompletedAt?.toISOString() ?? null;
        }

        // ─── Impersonation: start by swapping token claims, stop by restoring. ───
        const impersonateUserId = (updateSession as any).impersonateUserId as string | undefined;
        const stopImpersonation = (updateSession as any).stopImpersonation === true;

        if (stopImpersonation && token.preImpersonation) {
          // Restore the snapshot. The server-side impersonate endpoint already verified
          // the audit log; here we just trust the snapshot present in the JWT.
          const prev = token.preImpersonation as {
            sub: string;
            role?: string;
            email?: string | null;
            name?: string | null;
            tenantId?: string | null;
            branchId?: string | null;
            branchName?: string | null;
            tenantName?: string | null;
            tenantSlug?: string | null;
            sessionVersion?: number;
            activeModule?: string;
            activeModules?: string[];
            permissions?: string[];
            roleId?: string;
            roleName?: string;
            featureFlags?: Record<string, boolean>;
          };
          Object.assign(token, prev);
          (token as any).sub = prev.sub;
          delete token.preImpersonation;
        } else if (impersonateUserId && token.role === "SUPER_ADMIN" && !token.preImpersonation) {
          // Only super admins can impersonate, and only when not already impersonating.
          const target = await prisma.user.findUnique({
            where: { id: impersonateUserId },
            include: { tenant: true, branch: true },
          });
          if (target && target.isActive && target.tenant?.isActive) {
            // Snapshot current token so we can restore.
            token.preImpersonation = {
              sub: token.sub!,
              role: token.role!,
              email: (token as any).email,
              name: (token as any).name,
              tenantId: token.tenantId ?? null,
              branchId: token.branchId ?? null,
              branchName: token.branchName ?? null,
              tenantName: token.tenantName ?? null,
              tenantSlug: token.tenantSlug ?? null,
              sessionVersion: token.sessionVersion,
              activeModule: token.activeModule,
              activeModules: token.activeModules,
              permissions: token.permissions,
              roleId: token.roleId,
              roleName: token.roleName,
              featureFlags: token.featureFlags,
            };
            // Swap to target user's claims.
            token.sub = target.id;
            token.role = target.role;
            (token as any).email = target.email;
            (token as any).name = target.name;
            token.tenantId = target.tenantId;
            token.branchId = target.branchId;
            token.branchName = target.branch?.name ?? "";
            token.tenantName = target.tenant.name;
            token.tenantSlug = target.tenant.slug;
            token.onboardingCompletedAt = target.tenant.onboardingCompletedAt?.toISOString() ?? null;
            token.isDemo = target.tenant.isDemo;
            const mods: string[] = target.tenant.activeModules ?? ["laundry"];
            token.activeModules = mods;
            token.activeModule = mods[0] ?? "laundry";
            token.sessionVersion = target.sessionVersion;
            const roleCtx = await loadRoleContext(target.id, target.role);
            token.permissions = roleCtx.permissions;
            token.roleId = roleCtx.roleId;
            token.roleName = roleCtx.roleName;
            token.featureFlags = await resolveAllFlagsSafe(target.tenantId as string);
          }
        }
      }

      // Remember-me: when "remember" was unchecked, invalidate the session after 8h.
      if (
        token.remember === false &&
        typeof token.sessionStartedAt === "number" &&
        Date.now() - (token.sessionStartedAt as number) > 8 * 60 * 60 * 1000
      ) {
        return null as any;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).branchId = token.branchId;
        (session.user as any).branchName = token.branchName;
        (session.user as any).tenantName = token.tenantName;
        (session.user as any).tenantSlug = token.tenantSlug;
        (session.user as any).activeModule = token.activeModule ?? "laundry";
        (session.user as any).activeModules = token.activeModules ?? ["laundry"];
        (session.user as any).permissions = token.permissions ?? [];
        (session.user as any).roleId = token.roleId;
        (session.user as any).roleName = token.roleName;
        (session.user as any).sessionVersion = token.sessionVersion;
        (session.user as any).featureFlags = token.featureFlags;
        (session.user as any).onboardingCompletedAt = token.onboardingCompletedAt;
        (session.user as any).isDemo = token.isDemo;
        (session.user as any).impersonating = !!token.preImpersonation;
        if (token.preImpersonation) {
          (session.user as any).impersonatedEmail = (session.user as any).email;
        }
      }
      return session;
    },
  },
});
