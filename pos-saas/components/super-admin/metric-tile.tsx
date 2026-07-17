import Link from "next/link";
import { type LucideIcon, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sparkline } from "./sparkline";

export type TileTone = "default" | "primary" | "success" | "warning" | "danger";
export type TileSpan = 1 | 2 | 3 | 4;

// ponytail: tinted icon tiles — tenant StatCard pattern.
const TONE_ICON: Record<TileTone, string> = {
  default: "bg-primary/10 text-primary",
  primary: "bg-primary/10 text-primary",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-300",
  danger: "bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300",
};

const SPAN_CLASS: Record<TileSpan, string> = {
  1: "col-span-1",
  2: "col-span-1 sm:col-span-2",
  3: "col-span-1 sm:col-span-2 lg:col-span-3",
  4: "col-span-1 sm:col-span-2 lg:col-span-4",
};

export function MetricTile({
  icon: Icon,
  label,
  value,
  sub,
  href,
  tone = "default",
  trend,
  span = 1,
  index = 0,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  href?: string;
  tone?: TileTone;
  trend?: number[];
  span?: TileSpan;
  index?: number;
}) {
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover/tile:scale-110",
            TONE_ICON[tone],
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        {href && (
          <ArrowUpRight className="h-4 w-4 text-muted-foreground/60 transition-transform group-hover/tile:translate-x-0.5 group-hover/tile:-translate-y-0.5" />
        )}
      </div>
      <div className="mt-4">
        <div
          className={cn(
            "font-bold tracking-tight sa-tnum leading-none text-foreground",
            span >= 2 ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl",
          )}
        >
          {value}
        </div>
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          {label}
        </div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
      {trend && trend.length > 1 && (
        <div className="mt-3 -mb-1">
          <Sparkline data={trend} tone={tone === "default" ? "primary" : tone} />
        </div>
      )}
    </>
  );

  // ponytail: shadcn Card look — rounded-xl + ring + shadow, lift on hover.
  const cls = cn(
    "group/tile relative flex flex-col overflow-hidden rounded-xl bg-card p-5 text-card-foreground ring-1 ring-foreground/10 shadow-sm transition-all duration-200 hover:shadow-md hover:ring-foreground/15",
    SPAN_CLASS[span],
    "animate-tile-in",
    href && "cursor-pointer hover:-translate-y-0.5",
  );

  const style = { animationDelay: `${Math.min(index, 8) * 40}ms` };

  if (href) {
    return (
      <Link href={href} className={cls} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
}
