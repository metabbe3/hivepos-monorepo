"use client";

import { ShoppingCart, Wallet, Settings, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  RESOURCE_ACTIONS,
  type Resource,
  type Action,
} from "@/lib/permissions/definitions";
import type { PermissionGroup } from "./permission-groups";
import { groupPermissionKeys } from "./permission-groups";
import { ResourcePermissionRow } from "./resource-permission-row";

const GROUP_ICONS: Record<PermissionGroup["iconKey"], LucideIcon> = {
  operasional: ShoppingCart,
  keuangan: Wallet,
  manajemen: Settings,
};

interface PermissionGroupSectionProps {
  group: PermissionGroup;
  resources: Resource[];
  permissions: string[];
  hasWildcard: boolean;
  locked?: boolean;
  onToggleResourceAction: (resource: Resource, action: Action) => void;
  onToggleGroup: (group: PermissionGroup, mode: "all" | "none") => void;
}

export function PermissionGroupSection({
  group,
  resources,
  permissions,
  hasWildcard,
  locked = false,
  onToggleResourceAction,
  onToggleGroup,
}: PermissionGroupSectionProps) {
  const Icon = GROUP_ICONS[group.iconKey];

  const groupKeys = groupPermissionKeys({ ...group, resources });
  const activeCount = groupKeys.filter((k) =>
    hasWildcard ? true : permissions.includes(k),
  ).length;
  const totalCount = groupKeys.length;
  const allActive = activeCount === totalCount;

  return (
    <section className="overflow-hidden rounded-xl border border-border/60 bg-card">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border/60 bg-card/95 px-4 py-2.5 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h4 className="truncate text-sm font-semibold">{group.label}</h4>
            <p className="truncate text-[11px] text-muted-foreground">
              {group.description}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "text-[11px] font-semibold tabular-nums",
              allActive
                ? "text-primary"
                : activeCount > 0
                  ? "text-foreground"
                  : "text-muted-foreground",
            )}
          >
            {activeCount}/{totalCount}
          </span>
          {!locked && !hasWildcard && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => onToggleGroup(group, allActive ? "none" : "all")}
            >
              {allActive ? "Kosongkan" : "Pilih semua"}
            </Button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="divide-y divide-border/40">
        {resources.map((r) => (
          <ResourcePermissionRow
            key={r}
            resource={r}
            permissions={permissions}
            hasWildcard={hasWildcard}
            locked={locked}
            onToggleAction={onToggleResourceAction}
          />
        ))}
      </div>
    </section>
  );
}

// Re-export for type usage
export { RESOURCE_ACTIONS };
