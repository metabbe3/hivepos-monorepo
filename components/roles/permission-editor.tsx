"use client";

import { useMemo, useState, useCallback } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  RESOURCE_LABELS,
  WILDCARD,
  type Resource,
  type Action,
} from "@/lib/permissions/definitions";
import {
  PERMISSION_GROUPS,
  TOTAL_PERMISSIONS,
  groupPermissionKeys,
  type PermissionGroup,
} from "./permission-groups";
import { PermissionGroupSection } from "./permission-group-section";
import { PermissionSummaryBar } from "./permission-summary-bar";
import { cn } from "@/lib/utils";

interface PermissionEditorProps {
  permissions: string[];
  onChange: (next: string[]) => void;
  locked?: boolean;
  className?: string;
}

export function PermissionEditor({
  permissions,
  onChange,
  locked = false,
  className,
}: PermissionEditorProps) {
  const [search, setSearch] = useState("");
  const hasWildcard = permissions.includes(WILDCARD);

  const matches = useCallback(
    (resource: Resource) =>
      !search ||
      RESOURCE_LABELS[resource].toLowerCase().includes(search.toLowerCase()),
    [search],
  );

  const filteredGroups = useMemo(
    () =>
      PERMISSION_GROUPS.map((g) => ({
        ...g,
        resources: g.resources.filter(matches),
      })).filter((g) => g.resources.length > 0),
    [matches],
  );

  const activeCount = hasWildcard
    ? TOTAL_PERMISSIONS
    : permissions.filter((p) => p !== WILDCARD).length;

  const allEmpty = filteredGroups.length === 0;

  const toggleAction = (resource: Resource, action: Action) => {
    if (locked || hasWildcard) return;
    const perm = `${resource}:${action}`;
    if (permissions.includes(perm)) {
      onChange(permissions.filter((p) => p !== perm));
    } else {
      onChange([...permissions, perm]);
    }
  };

  const toggleGroup = (group: PermissionGroup, mode: "all" | "none") => {
    if (locked || hasWildcard) return;
    const keys = groupPermissionKeys(group);
    if (mode === "all") {
      const set = new Set([...permissions, ...keys]);
      onChange([...set]);
    } else {
      const remove = new Set(keys);
      onChange(permissions.filter((p) => !remove.has(p)));
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari modul… (contoh: orders, pelanggan, laporan)"
          className="h-9 pl-9"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
        <PermissionSummaryBar
          count={activeCount}
          total={TOTAL_PERMISSIONS}
          locked={hasWildcard}
          size="md"
          showLabel
        />
        {activeCount === 0 && !hasWildcard && (
          <span className="text-[11px] italic text-muted-foreground">
            Belum ada izin dipilih
          </span>
        )}
      </div>

      {/* Groups — mobile: flow in document; desktop: constrained scroll area */}
      <div className="space-y-3 md:max-h-[52vh] md:overflow-y-auto md:pr-1">
        {filteredGroups.map((g) => (
          <PermissionGroupSection
            key={g.id}
            group={g}
            resources={g.resources}
            permissions={permissions}
            hasWildcard={hasWildcard}
            locked={locked}
            onToggleResourceAction={toggleAction}
            onToggleGroup={toggleGroup}
          />
        ))}

        {allEmpty && (
          <div className="rounded-lg border border-dashed border-border/60 py-10 text-center">
            <Search className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-sm text-muted-foreground">
              Tidak ada modul yang cocok dengan &quot;{search}&quot;
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
