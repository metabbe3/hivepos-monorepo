import Link from "next/link";
import { cn } from "@/lib/utils";

export type FilterOption = { key: string; label: string };
export type FilterGroup = {
  field: string;
  options: FilterOption[];
  active: string; // "ALL" or a specific key
};

export function FilterBar({
  groups,
  buildHref,
  className,
}: {
  groups: FilterGroup[];
  buildHref: (field: string, key: string) => string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {groups.map((g) => (
        // ponytail: soft pill container, ghost defaults, solid background when active.
        <div
          key={g.field}
          className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5"
        >
          {g.options.map((o) => {
            const isActive = g.active === o.key;
            const isAll = o.key === "ALL";
            const href = buildHref(g.field, isAll ? "ALL" : o.key);
            return (
              <Link
                key={o.key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {o.label}
              </Link>
            );
          })}
        </div>
      ))}
    </div>
  );
}
