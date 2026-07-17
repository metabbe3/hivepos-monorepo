import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  // ponytail: matches tenant EmptyState — soft primary-tinted icon, dashed border.
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 py-16 text-center", className)}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
        <Icon className="h-6 w-6 text-primary/60" />
      </div>
      <h3 className="mt-5 text-base tracking-tight">{title}</h3>
      {hint && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
