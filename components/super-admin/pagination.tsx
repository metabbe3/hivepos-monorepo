import Link from "next/link";
import { cn } from "@/lib/utils";

export function Pagination({
  page,
  hasNext,
  buildHref,
  className,
}: {
  page: number;
  hasNext: boolean;
  buildHref: (p: number) => string;
  className?: string;
}) {
  // ponytail: matches shadcn outline button — soft border, hover bg-muted.
  const btnCls =
    "inline-flex h-7 items-center rounded-lg border border-border bg-background px-2.5 text-[0.8rem] font-medium transition-colors hover:bg-muted hover:text-foreground";
  return (
    <div className={cn("mt-4 flex items-center justify-between text-sm", className)}>
      <span className="text-xs text-muted-foreground">
        Page <span className="sa-tnum text-foreground">{page}</span>
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={buildHref(page - 1)} className={btnCls}>
            Previous
          </Link>
        )}
        {hasNext && (
          <Link href={buildHref(page + 1)} className={btnCls}>
            Next
          </Link>
        )}
      </div>
    </div>
  );
}

export function CountChip({
  count,
  label,
  tone = "default",
  className,
}: {
  count: number;
  label: string;
  tone?: "default" | "warning" | "danger" | "primary";
  className?: string;
}) {
  // ponytail: translucent tinted chip — matches status-pill pattern.
  const toneClass = {
    default: "bg-muted text-muted-foreground",
    primary: "bg-primary/10 text-primary",
    warning: "bg-amber-100/80 text-amber-600 dark:bg-amber-900/40 dark:text-amber-300",
    danger: "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 text-xs font-medium", toneClass, className)}>
      <span className="sa-tnum">{count}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}
