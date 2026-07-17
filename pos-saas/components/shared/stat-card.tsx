"use client";

import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  /** Tailwind color class for the icon (e.g. "text-blue-600") */
  iconColor?: string;
  /** Accent background for the icon container (e.g. "bg-blue-50 dark:bg-blue-950/50") */
  iconBg?: string;
  /** Extra content rendered below the value (trend badge, subtitle, etc.) */
  extra?: ReactNode;
  /** Optional accent color for the top border */
  accentColor?: string;
  /** Optional subtitle text */
  subtitle?: string;
  /** Optional size variant */
  size?: "default" | "lg";
  /** Optional sparkline data points (7-day mini trend) */
  sparkline?: number[];
  /** Sparkline fill color (e.g. "#10b981") */
  sparklineColor?: string;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = "text-primary",
  iconBg = "bg-primary/10",
  extra,
  accentColor,
  subtitle,
  size = "default",
  sparkline,
  sparklineColor = "#10b981",
}: StatCardProps) {
  const isLg = size === "lg";
  const hasSparkline = sparkline && sparkline.length >= 2;

  return (
    <Card className="h-full group relative overflow-hidden border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      {accentColor && (
        <div className={`absolute inset-x-0 top-0 h-1.5 ${accentColor}`} />
      )}
      <CardContent className={`flex items-center gap-4 py-4 px-4`}>
        <div
          className={`flex ${isLg ? "h-12 w-12" : "h-10 w-10"} shrink-0 items-center justify-center rounded-xl ${iconBg} transition-transform duration-200 group-hover:scale-110`}
        >
          <Icon className={`${isLg ? "h-6 w-6" : "h-5 w-5"} ${iconColor}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            {title}
          </p>
          <div className="mt-0.5 flex items-baseline gap-2">
            <p className={`${isLg ? "text-3xl" : "text-2xl"} font-extrabold sa-tnum tracking-tight`}>{value}</p>
          </div>
          {subtitle && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/80">
              {subtitle}
            </p>
          )}
          <div className="mt-1 min-h-[24px]">{extra}</div>
        </div>
        {hasSparkline && (
          <div className="w-16 h-8 shrink-0 opacity-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline.map((v, i) => ({ v }))}>
                <defs>
                  <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={sparklineColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={sparklineColor}
                  fill={`url(#spark-${title})`}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
