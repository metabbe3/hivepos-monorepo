import type { Metadata } from "next";
import { SessionProvider } from "@/lib/auth-client";

// ponytail: noindex auth pages — they shouldn't compete with marketing in search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// SessionProvider mounts so reloadSession() fires on load — that's how the Google OAuth
// httpOnly hp_session cookie gets probed (→ /auth/me → redirect to /dashboard). Without it,
// /login never detects the cookie set by the callback and bounces back here.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
