import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export function DetailShell({
  title,
  backHref,
  backLabel = "Back",
  headerExtra,
  children,
  className,
}: {
  title?: string;
  backHref: string;
  backLabel?: string;
  headerExtra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-2 text-sm">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      </div>
      {(title || headerExtra) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
          {headerExtra && <div className="flex shrink-0 items-center gap-2">{headerExtra}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

export function DetailSection({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  // ponytail: shadcn Card — rounded-xl + ring + shadow, plain header row.
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 shadow-sm",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
          <h2 className="text-base font-medium">{title}</h2>
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
