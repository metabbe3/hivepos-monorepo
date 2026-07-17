import Link from "next/link";
import { type LucideIcon, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  icon: Icon,
  actions,
  crumb,
  className,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
  crumb?: Crumb;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex items-start gap-4 min-w-0">
        {Icon && (
          // ponytail: tinted icon tile — matches tenant StatCard pattern.
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Icon className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          {crumb && (
            <nav className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-foreground transition-colors">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              <ChevronRight className="h-3 w-3" />
            </nav>
          )}
          {eyebrow && (
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
