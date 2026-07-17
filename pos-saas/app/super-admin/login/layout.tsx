"use client";

import { SessionProvider } from "next-auth/react";

// ponytail: tiny layout just to give /super-admin/login a SessionProvider so useSession works.
// The panel has its own provider in (panel)/layout.tsx; this one is outside that route group.
export default function SuperAdminLoginLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
