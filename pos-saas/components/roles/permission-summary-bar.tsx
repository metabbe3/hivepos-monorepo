"use client";

import { cn } from "@/lib/utils";

interface PermissionSummaryBarProps {
  count: number;
  total: number;
  locked?: boolean;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function PermissionSummaryBar({
  count,
  total,
  locked = false,
  size = "sm",
  showLabel = false,
}: PermissionSummaryBarProps) {
  const pct = total > 0 ? Math.min(100, (count / total) * 100) : 0;
  const barWidth = size === "md" ? "w-32" : "w-20";
  const labelSize = size === "md" ? "text-xs" : "text-[11px]";

  return (
    <div className="flex items-center gap-2">
      <span
        className={cn(
          "font-medium tabular-nums text-muted-foreground",
          labelSize,
          showLabel && "text-foreground",
        )}
      >
        {locked ? "Full Access" : `${count} dari ${total} izin`}
      </span>
      <div
        className={cn(
          "h-2 overflow-hidden rounded-full bg-muted",
          barWidth,
        )}
      >
        <div
          className={cn(
            "h-full rounded-full transition-all duration-300 ease-out",
            locked ? "bg-amber-500" : "bg-primary",
          )}
          style={{ width: `${locked ? 100 : pct}%` }}
        />
      </div>
    </div>
  );
}
