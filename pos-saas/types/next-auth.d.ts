import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id?: string;
      role?: string;
      tenantId?: string | null;
      branchId?: string | null;
      branchName?: string;
      tenantName?: string;
      tenantSlug?: string | null;
      activeModule?: string;
      activeModules?: string[];
      /** RBAC permission strings from the user's Role, e.g. ["orders:read", ...]. */
      permissions?: string[];
      /** RBAC role id (FK to Role). */
      roleId?: string;
      /** RBAC role display name. */
      roleName?: string;
      /** Server-side session version for live permission refresh. */
      sessionVersion?: number;
      /** When true, this session is a super-admin impersonating a tenant user. */
      impersonating?: boolean;
      /** Email of the impersonated user (for banner display). */
      impersonatedEmail?: string;
      /** Resolved feature flags for this tenant (key → enabled). */
      featureFlags?: Record<string, boolean>;
      /** ISO timestamp the owner finished/skipped onboarding; null until then. */
      onboardingCompletedAt?: string | null;
      /** True for sandbox demo tenants (isolated, auto-expiring). */
      isDemo?: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    tenantId?: string | null;
    branchId?: string | null;
    branchName?: string;
    tenantName?: string;
    tenantSlug?: string | null;
    sessionVersion?: number;
    activeModule?: string;
    activeModules?: string[];
    permissions?: string[];
    roleId?: string;
    roleName?: string;
    /** Resolved feature flags for this tenant (key → enabled). */
    featureFlags?: Record<string, boolean>;
    /** ISO timestamp the owner finished/skipped onboarding; null until then. */
    onboardingCompletedAt?: string | null;
    /** True for sandbox demo tenants (isolated, auto-expiring). */
    isDemo?: boolean;
    /** When set, current token is an impersonation session. Restoring this object stops impersonation. */
    preImpersonation?: {
      sub: string;
      role: string;
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
  }
}
