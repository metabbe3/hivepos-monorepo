"use client";

import { useSession } from "next-auth/react";

// ponytail: client hook reads flags from the session JWT (populated at login
// by lib/auth.ts). No extra round-trip per render. Defaults to true when the
// flag is unknown — permissive so missing seeds never hide features.
export function useFeatureFlag(key: string): boolean {
  const { data: session } = useSession();
  const flags = (session?.user as any)?.featureFlags as
    | Record<string, boolean>
    | undefined;
  return flags?.[key] ?? true;
}

export function useFeatureFlags(): Record<string, boolean> {
  const { data: session } = useSession();
  return (
    ((session?.user as any)?.featureFlags as Record<string, boolean> | undefined) ??
    {}
  );
}
