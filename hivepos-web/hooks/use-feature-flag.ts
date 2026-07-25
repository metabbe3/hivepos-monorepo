"use client";

import { useSession } from "@/lib/auth-client";

// ponytail: client hook reads flags from the session JWT (populated at login
// by lib/auth.ts from the FeatureFlag table). No extra round-trip per render.
// Fail-CLOSED: an unknown/missing key resolves to false, so an un-seeded flag
// never silently enables a feature for everyone. All keys referenced in the FE
// (staffAttendance, customersImportExport, orderFlowV2, offlineOrderCreate,
// onboardingWizard) are seeded by api SeedFeatureFlags, so legit features still
// resolve from the JWT.
export function useFeatureFlag(key: string): boolean {
  const { data: session } = useSession();
  const flags = (session?.user as any)?.featureFlags as
    | Record<string, boolean>
    | undefined;
  return flags?.[key] ?? false;
}

export function useFeatureFlags(): Record<string, boolean> {
  const { data: session } = useSession();
  return (
    ((session?.user as any)?.featureFlags as Record<string, boolean> | undefined) ??
    {}
  );
}
