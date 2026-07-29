"use client";

// JWT client auth — drop-in replacement for next-auth/react used during the port.
// The JWT lives ONLY in the httpOnly hp_session cookie (set by the backend on
// /auth/login + /auth/login-bounce); apiFetch sends it via credentials:"include".
// No localStorage token (XSS-exfilable) — JS can't read the cookie.
// Exposes the same names/shapes pos-saas used: useSession(), signIn(), signOut(), SessionProvider.

import { useCallback, useEffect, useReducer } from "react";
import { apiFetch, ApiClientError } from "@/lib/api/client";
import { DEFAULT_ROLES } from "@/lib/permissions/defaults";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "/api").replace(/\/$/, "");

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";
export interface Session {
  user: Record<string, unknown> & {
    id?: string;
    email?: string;
    name?: string;
    role?: string;
    tenantId?: string;
    branchId?: string;
    permissions?: string[];
    featureFlags?: Record<string, boolean>;
  };
}

// ── module-level store (mirrors next-auth's module-level signIn/signOut) ──
let currentSession: Session | null = null;
let currentStatus: SessionStatus = "loading";
const subscribers = new Set<() => void>();
const emit = () => subscribers.forEach((fn) => fn());

export async function reloadSession(): Promise<void> {
  // Always probe /auth/me — extractToken dual-reads Bearer (localStorage) + httpOnly
  // hp_session cookie (Google OAuth). Gating on getAuthToken() skipped cookie-only
  // sessions, so Google login set the cookie but the FE never noticed → bounced to /login.
  try {
    const { data } = await apiFetch<{ user: Record<string, unknown>; claims?: Record<string, unknown> }>(
      "/auth/me",
    );
    // ponytail: merge user + claims into one flat session.user (pos-saas shape). Go's /me is
    // leaner than pos-saas's NextAuth session; missing fields are undefined, not blocking.
    // Expand role→permissions here (source of truth) so every consumer (useRole.isOwner,
    // usePermissions.can) sees the full list. Go currently sends the role NAME in permissions
    // (e.g. ["OWNER"]); DEFAULT_ROLES maps Owner→["*"]. Safe no-op once Go sends the full list.
    const role = (data.claims?.role ?? data.user?.role) as string | undefined;
    const roleDefaultPerms =
      (role && DEFAULT_ROLES.find((r) => r.name.toUpperCase() === role.toUpperCase())?.permissions) ||
      [];
    const permissions = Array.from(
      new Set([...((data.claims?.permissions as string[]) ?? []), ...roleDefaultPerms]),
    );
    const merged = { ...data.user, ...(data.claims ?? {}) };
    // Go /me omits onboardingCompletedAt → default to createdAt (or a marker) so authenticated
    // users with a tenant+branch aren't forced to /onboarding (dashboard redirect guard).
    const onboardingCompletedAt =
      (merged.onboardingCompletedAt as string | undefined) ??
      (merged.createdAt as string | undefined) ??
      "completed";
    currentSession = {
      user: { ...merged, permissions, onboardingCompletedAt } as Session["user"],
    };
    currentStatus = "authenticated";
    emit();
    return;
  } catch (e) {
    // Only an auth rejection (bad/expired/revoked token) is a real logout.
    // Transient failures (429 rate-limit, 5xx, network blip) must NOT clear a
    // valid token — that turned the orders-page session-version 405 spam (which
    // rate-limited /auth/me to 429) into a forced logout + /login redirect loop.
    const authRejected =
      e instanceof ApiClientError && (e.httpStatus === 401 || e.httpStatus === 403);
    if (!authRejected) {
      // Leave session untouched; a blip shouldn't log out a valid user.
      return;
    }
    // The httpOnly cookie can't be cleared from JS — the backend clears it on
    // /auth/logout, or it expires. Here we just mark the session gone client-side.
    currentSession = null;
    currentStatus = "unauthenticated";
    emit();
  }
}

interface SignInOptions {
  email?: string;
  password?: string;
  callbackUrl?: string;
  redirect?: boolean;
}

export async function signIn(
  provider?: string,
  // ponytail: opts typed as any to swallow whatever pos-saas call sites pass
  // (email/password/remember/callbackUrl/redirect). Tighten once call sites are audited.
  opts?: any,
): Promise<{ ok: boolean; error?: string }> {
  if (provider === "google") {
    // Top-level redirect to the backend OAuth start; Google → callback → httpOnly hp_session
    // cookie → 302 /login. reloadSession() probes /auth/me on mount to pick up that cookie.
    if (typeof window !== "undefined") window.location.href = `${BASE}/auth/google`;
    return { ok: false };
  }
  try {
    const { data } = await apiFetch<{ token: string }>("/auth/login", {
      method: "POST",
      body: {
        email: opts?.email ?? "",
        password: opts?.password ?? "",
        // scope gates the auth table on the backend ("super-admin" → SuperAdmin).
        ...(opts?.scope ? { scope: opts.scope } : {}),
      },
    });
    // Backend sets the httpOnly hp_session cookie on this response (data.token is
    // returned but no longer stored — cookie-only auth). reloadSession probes
    // /auth/me, which reads the cookie.
    void data;
    await reloadSession();
    if (opts?.callbackUrl && typeof window !== "undefined") window.location.href = opts.callbackUrl;
    return { ok: true };
  } catch (e) {
    const msg = e instanceof ApiClientError ? e.message : "Login failed";
    return { ok: false, error: msg };
  }
}

export async function signOut(opts?: { callbackUrl?: string } & Record<string, unknown>): Promise<void> {
  // Clear the httpOnly session cookies server-side. JS can't touch them, so the
  // /auth/logout call (which Set-Cookie expires hp_session + the legacy
  // next-auth.session-token) is what actually logs the user out.
  try {
    await apiFetch("/auth/logout", { method: "POST" });
  } catch {
    // best-effort — session state is cleared below regardless
  }
  currentSession = null;
  currentStatus = "unauthenticated";
  emit();
  if (opts?.callbackUrl && typeof window !== "undefined") window.location.href = opts.callbackUrl;
}

export function useSession(): {
  // ponytail: data is `any` so the many pos-saas session.user.<field> accesses compile during
  // the port (pos-saas relied on an augmented next-auth Session type we no longer have). Tighten later.
  data: any;
  status: SessionStatus;
  // next-auth's useSession exposes update(); pos-saas call sites use it. Maps to reloadSession.
  update: (data?: unknown) => Promise<void>;
} {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    subscribers.add(force);
    return () => {
      subscribers.delete(force);
    };
  }, [force]);
  return { data: currentSession as any, status: currentStatus, update: reloadSession };
}

export function SessionProvider({ children }: { children: React.ReactNode } & Record<string, unknown>) {
  const doReload = useCallback(() => {
    void reloadSession();
  }, []);
  useEffect(() => {
    doReload();
  }, [doReload]);
  return <>{children}</>;
}

// Re-export so existing `import { useAuth }` style works too (forward-compat).
export function useAuth() {
  return useSession();
}
