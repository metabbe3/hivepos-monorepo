"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";

/**
 * Watches the NextAuth session and forces sign-out when the session
 * has been invalidated by a newer login on another device
 * (sessionVersion mismatch → user.id becomes empty string).
 */
export function SessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user && !session.user.id) {
      // Session invalidated — force logout
      signOut({ callbackUrl: "/login" });
    }
  }, [session, status, signOut]);

  return <>{children}</>;
}
