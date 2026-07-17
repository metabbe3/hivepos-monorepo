"use client";

import { Mail, Phone, Calendar, ShieldCheck, Crown, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { LucideIcon } from "lucide-react";
import { ProfileAvatar } from "./profile-avatar";

/** Visual tier derived from the user's role. Drives the accent strip + badge color. */
type RoleTier = "owner" | "super-admin" | "manager" | "employee";

interface RoleTierMeta {
  /** Accent strip gradient (Tailwind `from-X-500 to-X-600`). */
  gradient: string;
  /** Soft tinted badge classes. */
  badge: string;
  icon: LucideIcon;
}

const ROLE_TIER_META: Record<RoleTier, RoleTierMeta> = {
  owner: {
    gradient: "from-emerald-500 to-emerald-600",
    badge:
      "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-300",
    icon: Crown,
  },
  "super-admin": {
    gradient: "from-purple-500 to-purple-600",
    badge:
      "bg-purple-100 text-purple-800 hover:bg-purple-100 dark:bg-purple-900/40 dark:text-purple-300",
    icon: Sparkles,
  },
  manager: {
    gradient: "from-indigo-500 to-indigo-600",
    badge:
      "bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-300",
    icon: ShieldCheck,
  },
  employee: {
    gradient: "from-sky-500 to-sky-600",
    badge:
      "bg-sky-100 text-sky-800 hover:bg-sky-100 dark:bg-sky-900/40 dark:text-sky-300",
    icon: ShieldCheck,
  },
};

export function deriveRoleTier(
  role: string,
  hasWildcard: boolean,
): RoleTier {
  if (hasWildcard) return "owner";
  if (role === "SUPER_ADMIN") return "super-admin";
  if (role === "MANAGER" || role === "ADMIN") return "manager";
  return "employee";
}

interface ProfileHeroProps {
  name: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  roleName: string;
  role: string;
  hasWildcard: boolean;
}

export function ProfileHero({
  name,
  email,
  phone,
  createdAt,
  roleName,
  role,
  hasWildcard,
}: ProfileHeroProps) {
  const { t } = useTranslation();
  const tier = deriveRoleTier(role, hasWildcard);
  const meta = ROLE_TIER_META[tier];
  const RoleIcon = meta.icon;
  const displayName = name || email || "—";

  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-xl border-border/60 shadow-sm",
        "bg-gradient-to-br from-primary/10 via-primary/5 to-transparent",
      )}
    >
      {/* Accent strip colored by role tier */}
      <div
        className={cn(
          "h-1.5 w-full shrink-0 bg-gradient-to-r",
          meta.gradient,
        )}
      />

      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <ProfileAvatar
            name={displayName}
            size="xl"
            className="ring-4 ring-background shadow-xl"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold leading-tight">
                {displayName}
              </h1>
              <Badge
                className={cn(
                  "gap-1 border-0 px-2.5 py-1 text-[11px] font-semibold",
                  meta.badge,
                )}
              >
                <RoleIcon className="h-3 w-3" />
                {roleName || role}
              </Badge>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {email && (
                <a
                  href={`mailto:${email}`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span className="truncate">{email}</span>
                </a>
              )}
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Phone className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{phone}</span>
                </a>
              )}
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                {t("profile.heroMemberSince")} {formatDate(createdAt)}
              </span>
            </div>
          </div>

          {/* Active status pill */}
          <div className="flex shrink-0 items-center gap-2 self-start rounded-full border border-emerald-200/60 bg-emerald-50/80 px-3 py-1.5 dark:border-emerald-800/40 dark:bg-emerald-950/40">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              {t("profile.active")}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
