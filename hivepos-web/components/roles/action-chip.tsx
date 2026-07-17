"use client";

import { cn } from "@/lib/utils";

interface ActionChipProps {
  label: string;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
  tone?: "primary" | "danger";
}

export function ActionChip({
  label,
  active,
  disabled,
  onToggle,
  tone = "primary",
}: ActionChipProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      data-active={active}
      disabled={disabled}
      onClick={onToggle}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-full border px-3 text-xs font-medium",
        "transition-all duration-150 outline-none select-none",
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:border-ring",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "active:scale-95",
        // inactive base — solid bg for contrast, darker text for readability
        "border-border bg-muted/60 text-muted-foreground",
        "hover:bg-muted hover:text-foreground",
        // active states
        tone === "danger"
          ? "data-[active=true]:border-destructive data-[active=true]:bg-destructive data-[active=true]:text-destructive-foreground"
          : "data-[active=true]:border-primary data-[active=true]:bg-primary data-[active=true]:text-primary-foreground",
      )}
    >
      {label}
    </button>
  );
}
