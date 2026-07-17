"use client";

import { useSession, signOut } from "@/lib/auth-client";
import { useEffect, useRef } from "react";

/**
 * Guards protected pages against two session-end scenarios:
 * 1. JWT expired → reloadSession gets 401 → status = "unauthenticated" → redirect.
 * 2. Session version mismatch (newer login elsewhere) → user.id empty → signOut.
 *
 * Cooldown: prevents redirect loops when useSessionSync triggers a transient
 * "unauthenticated" (e.g., network blip) then recovers. Only one redirect per 5s.
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const lastRedirect = useRef(0);

  useEffect(() => {
    // JWT expired or token cleared → redirect to login (with cooldown).
    if (status === "unauthenticated") {
      const now = Date.now();
      if (now - lastRedirect.current > 5000) {
        lastRedirect.current = now;
        window.location.href = "/login";
      }
      return;
    }
    // Reset cooldown when authenticated.
    if (status === "authenticated") {
      lastRedirect.current = 0;
    }
    // Session invalidated by a newer login → force logout.
    if (status === "authenticated" && session?.user && !session.user.id) {
      signOut({ callbackUrl: "/login" });
    }
  }, [session, status, signOut]);

  return <>{children}</>;
}
