"use client";

import { cn } from "@/lib/utils";
import {
  RESOURCE_ACTIONS,
  RESOURCE_LABELS,
  ACTION_LABELS,
  type Resource,
  type Action,
} from "@/lib/permissions/definitions";
import { RESOURCE_ICONS } from "./resource-icons";
import { ActionChip } from "./action-chip";

interface ResourcePermissionRowProps {
  resource: Resource;
  permissions: string[];
  hasWildcard: boolean;
  locked?: boolean;
  onToggleAction: (resource: Resource, action: Action) => void;
}

export function ResourcePermissionRow({
  resource,
  permissions,
  hasWildcard,
  locked = false,
  onToggleAction,
}: ResourcePermissionRowProps) {
  const Icon = RESOURCE_ICONS[resource];

  const isChecked = (action: Action): boolean => {
    if (hasWildcard) return true;
    return permissions.includes(`${resource}:${action}`);
  };

  return (
    <div
      className={cn(
        "group/resource flex flex-col gap-2 px-3 py-2.5 transition-colors",
        "hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-medium">
          {RESOURCE_LABELS[resource]}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {RESOURCE_ACTIONS[resource].map((action) => (
          <ActionChip
            key={action}
            label={ACTION_LABELS[action]}
            active={isChecked(action)}
            disabled={locked || hasWildcard}
            tone={action === "delete" ? "danger" : "primary"}
            onToggle={() => onToggleAction(resource, action)}
          />
        ))}
      </div>
    </div>
  );
}
