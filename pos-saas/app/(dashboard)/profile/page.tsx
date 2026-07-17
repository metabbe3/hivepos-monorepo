"use client";

import { Suspense, useEffect, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import { useRole } from "@/hooks/use-role";
import { useWakeLock } from "@/hooks/use-wake-lock";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { PageHeader } from "@/components/shared/page-header";
import { ProfileHero } from "@/components/profile/profile-hero";
import { AccountContextCard } from "@/components/profile/account-context-card";
import { PersonalInfoCard } from "@/components/profile/personal-info-card";
import { PasswordChangeCard } from "@/components/profile/password-change-card";
import { LinkedAccountsCard } from "@/components/profile/linked-accounts-card";
import { MyTicketsCard } from "@/components/profile/my-tickets-card";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import type { ProfileData } from "@/components/profile/types";

export default function ProfilePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ProfileContent />
    </Suspense>
  );
}

function ProfileContent() {
  const { t } = useTranslation();
  const {
    tenantName,
    branchName,
    activeModule,
    activeModules,
    roleName,
    permissions,
    role,
    updateSession,
  } = useRole();
  const hasWildcard = permissions.includes("*");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    apiFetch<ProfileData>("/api/user/profile")
      .then((r) => setProfile(r.data))
      .catch((err) => {
        if (err instanceof ApiClientError) toast.error(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Success toast after returning from Google OAuth linking flow.
  useEffect(() => {
    if (searchParams.get("linked") === "google") {
      toast.success(t("profile.googleLinkSuccess"));
      // Strip the param so a refresh doesn't re-toast.
      const url = new URL(window.location.href);
      url.searchParams.delete("linked");
      window.history.replaceState(null, "", url.toString());
    }
  }, [searchParams, t]);

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader title={t("profile.title")} description={t("profile.description")} />

      <ProfileHero
        name={profile.name ?? ""}
        email={profile.email}
        phone={profile.phone}
        createdAt={profile.createdAt}
        roleName={roleName}
        role={role ?? profile.role}
        hasWildcard={hasWildcard}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Left column: forms stack */}
        <div className="flex flex-col gap-5 lg:col-span-2">
          <PersonalInfoCard
            name={profile.name ?? ""}
            phone={profile.phone ?? ""}
            email={profile.email ?? ""}
            onSaved={(name, phone) => {
              setProfile({ ...profile, name, phone });
              updateSession();
            }}
          />
          <LinkedAccountsCard
            googleId={profile.googleId ?? null}
            avatar={profile.avatar ?? null}
            email={profile.email ?? null}
            onChanged={({ googleId }) => setProfile({ ...profile, googleId })}
          />
          <PasswordChangeCard />
          <PwaPreferencesCard />
          <MyTicketsCard />
        </div>

        {/* Right column: account sidebar spans both rows */}
        <div className="lg:row-span-2">
          <AccountContextCard
            tenantName={tenantName}
            branchName={branchName}
            activeModule={activeModule}
            activeModules={activeModules}
            roleName={roleName}
            permissionsCount={permissions.length}
            hasWildcard={hasWildcard}
          />
        </div>
      </div>
    </div>
  );
}

// ponytail: localStorage-backed (not DB) because wake lock is a per-device
// concern — a kasir's phone needs it, the owner's laptop doesn't. No schema
// change, no API. Same pattern as `theme` / `pos.lastPrinter`.
function PwaPreferencesCard() {
  const { t } = useTranslation();
  const { enabled, supported, toggle } = useWakeLock();

  return (
    <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Smartphone className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wide">
              {t("profile.pwaPrefs")}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {t("profile.pwaPrefsDesc")}
            </p>
          </div>
        </div>

        <label
          htmlFor="wake-lock"
          className="flex items-start justify-between gap-4"
        >
          <div className="space-y-0.5">
            <p className="text-sm font-medium">{t("profile.wakeLock")}</p>
            <p className="text-[11px] text-muted-foreground">
              {supported
                ? t("profile.wakeLockHint")
                : t("profile.wakeLockUnsupported")}
            </p>
          </div>
          <Switch
            id="wake-lock"
            checked={enabled}
            onCheckedChange={(v) => toggle(v)}
            disabled={!supported}
          />
        </label>
      </CardContent>
    </Card>
  );
}
