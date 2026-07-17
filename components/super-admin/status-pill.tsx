import { cn } from "@/lib/utils";

export type PillTone =
  | "default"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "muted";

// ponytail: translucent tinted badges — matches tenant status pattern
// (bg-{c}-100/80 text-{c}-600 dark:bg-{c}-900/40 dark:text-{c}-300).
const TONE_CLASS: Record<PillTone, string> = {
  default: "bg-muted text-muted-foreground",
  primary: "bg-primary/10 text-primary dark:bg-primary/20",
  success: "bg-emerald-100/80 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300",
  warning: "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
  danger: "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  muted: "bg-muted text-muted-foreground",
};

const DOT_CLASS: Record<PillTone, string> = {
  default: "bg-muted-foreground/60",
  primary: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
  muted: "bg-muted-foreground/60",
};

export function StatusPill({
  tone = "default",
  label,
  dot = false,
  pulse = false,
  className,
}: {
  tone?: PillTone;
  label: React.ReactNode;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
                DOT_CLASS[tone],
              )}
            />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", DOT_CLASS[tone])} />
        </span>
      )}
      {label}
    </span>
  );
}
