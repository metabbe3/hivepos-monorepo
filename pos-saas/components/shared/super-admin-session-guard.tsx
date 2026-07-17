"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect } from "react";

/**
 * Like SessionGuard, but signs out to /super-admin/login (not /login).
 * Use only inside the /super-admin/(panel) layout.
 */
export function SuperAdminSessionGuard({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "authenticated" && session?.user && !session.user.id) {
      signOut({ callbackUrl: "/super-admin/login" });
    }
  }, [session, status]);

  return <>{children}</>;
}
