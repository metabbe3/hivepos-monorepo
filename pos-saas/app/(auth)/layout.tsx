import type { Metadata } from "next";

// ponytail: noindex auth pages — they shouldn't compete with marketing in search.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
