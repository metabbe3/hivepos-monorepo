"use client";

import { Building2, MapPin, LayoutGrid, Shield, KeyRound } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import type { LucideIcon } from "lucide-react";

/** Map module keys to friendly labels (mirrors module-selector.tsx). */
const MODULE_LABELS: Record<string, string> = {
  laundry: "Laundry",
  fnb: "F&B",
  salon: "Salon",
  cleaning: "Cleaning",
};

function formatModule(mod: string): string {
  return MODULE_LABELS[mod] ?? mod.charAt(0).toUpperCase() + mod.slice(1);
}

interface AccountContextCardProps {
  tenantName: string;
  branchName: string;
  activeModule: string;
  activeModules: string[];
  roleName: string;
  permissionsCount: number;
  hasWildcard: boolean;
}

interface RowProps {
  icon: LucideIcon;
  label: string;
  value: string;
}

function Row({ icon: Icon, label, value }: RowProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-sm font-semibold">{value || "—"}</p>
      </div>
    </div>
  );
}

export function AccountContextCard({
  tenantName,
  branchName,
  activeModule,
  activeModules,
  roleName,
  permissionsCount,
  hasWildcard,
}: AccountContextCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="flex h-full flex-col overflow-hidden rounded-xl border-border/60 shadow-sm">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-center gap-2 border-b border-border/40 pb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold uppercase tracking-wide">
            {t("profile.account")}
          </h2>
        </div>

        <div className="flex flex-1 flex-col gap-4">
          <Row
            icon={Building2}
            label={t("profile.tenant")}
            value={tenantName}
          />
          <Row
            icon={MapPin}
            label={t("profile.branch")}
            value={branchName}
          />
          <Row
            icon={LayoutGrid}
            label={t("profile.activeModule")}
            value={formatModule(activeModule)}
          />
          <Row
            icon={Shield}
            label={t("profile.roleLabel")}
            value={roleName || "—"}
          />
        </div>

        {/* Footer: permissions summary */}
        <div className="border-t border-border/40 pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "gap-1 rounded-full px-2.5 py-1 text-[11px]",
                hasWildcard
                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  : "bg-primary/10 text-primary",
              )}
            >
              <KeyRound className="h-3 w-3" />
              {hasWildcard
                ? t("profile.allAccess")
                : t("profile.permissionsCount").replace(
                    "{count}",
                    String(permissionsCount),
                  )}
            </Badge>
            {activeModules.length > 1 && (
              <Badge
                variant="secondary"
                className="rounded-full px-2.5 py-1 text-[11px]"
              >
                {activeModules
                  .map((m) => formatModule(m))
                  .join(" · ")}
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
