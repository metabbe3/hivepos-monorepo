"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { HeatmapData } from "./dashboard-types";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

/** Map a 0–1 intensity to a discrete 0–5 level (GitHub-style). */
function bucket(intensity: number): number {
  if (intensity <= 0) return 0;
  if (intensity < 0.15) return 1;
  if (intensity < 0.35) return 2;
  if (intensity < 0.6) return 3;
  if (intensity < 0.85) return 4;
  return 5;
}

const HEAT_VARS = [
  "var(--heat-0)",
  "var(--heat-1)",
  "var(--heat-2)",
  "var(--heat-3)",
  "var(--heat-4)",
  "var(--heat-5)",
];

function heatBg(level: number): string {
  return HEAT_VARS[Math.min(Math.max(level, 0), 5)];
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

// ═══════════════════════════════════════════════════════════════
//  Shared types
// ═══════════════════════════════════════════════════════════════

interface CellHoverHandlers {
  onEnter: (e: React.MouseEvent<HTMLElement>, text: string) => void;
  onLeave: () => void;
}

interface HoverInfo {
  x: number;
  y: number;
  text: string;
}

// ═══════════════════════════════════════════════════════════════
//  Sub-components
// ═══════════════════════════════════════════════════════════════

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border/40 bg-muted/30 px-3 py-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="truncate text-sm font-bold leading-tight tabular-nums">
        {value}
      </span>
    </div>
  );
}

function HeatLegend({ minLabel, maxLabel }: { minLabel: string; maxLabel: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[10px] text-muted-foreground">
        {t("dashboard.heatFewer")}
      </span>
      <div className="flex gap-0.5">
        {HEAT_VARS.map((v, i) => (
          <div
            key={i}
            className={`h-3 w-3 rounded-[2px] ${i >= 4 ? "heat-pattern-high" : ""}`}
            style={{ backgroundColor: v }}
          />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">
        {t("dashboard.heatMore")}
      </span>
      <span className="ml-1 text-[10px] font-medium tabular-nums text-muted-foreground">
        {minLabel}–{maxLabel}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Busy Hours Tab
// ═══════════════════════════════════════════════════════════════

function BusyHoursTab({
  data,
  onEnter,
  onLeave,
}: { data: number[][] } & CellHoverHandlers) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    let total = 0;
    let maxVal = 0;
    let maxDay = 0;
    let maxHour = 0;
    const hourTotals = new Array(24).fill(0);

    for (let d = 0; d < data.length; d++) {
      const row = data[d] ?? [];
      for (let h = 0; h < row.length; h++) {
        const v = row[h];
        total += v;
        hourTotals[h] += v;
        if (v > maxVal) {
          maxVal = v;
          maxDay = d;
          maxHour = h;
        }
      }
    }

    let peakHour = 0;
    let peakHourVal = 0;
    for (let h = 0; h < 24; h++) {
      if (hourTotals[h] > peakHourVal) {
        peakHourVal = hourTotals[h];
        peakHour = h;
      }
    }

    return { total, maxVal, maxDay, maxHour, peakHour };
  }, [data]);

  return (
    <div className="space-y-3">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <StatPill
          label={t("dashboard.heatBusiestSlot")}
          value={stats.total > 0 ? `${DAY_LABELS[stats.maxDay]} ${pad2(stats.maxHour)}:00` : "—"}
        />
        <StatPill
          label={t("dashboard.heatPeakHour")}
          value={stats.total > 0 ? `${pad2(stats.peakHour)}:00` : "—"}
        />
        <StatPill
          label={t("dashboard.heatTotalOrders")}
          value={String(stats.total)}
        />
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[360px] space-y-[3px]">
          {/* Hour labels */}
          <div className="flex items-center gap-[2px]">
            <span className="w-7 shrink-0" />
            {Array.from({ length: 24 }, (_, h) => (
              <div
                key={h}
                className="w-[14px] text-center text-[9px] tabular-nums text-muted-foreground sm:w-[20px]"
              >
                {h % 3 === 0 ? pad2(h) : ""}
              </div>
            ))}
          </div>

          {/* Day rows */}
          {DAY_LABELS.map((day, dow) => {
            const row = data[dow] ?? [];
            return (
              <div key={day} className="flex items-center gap-[2px]">
                <span className="w-7 shrink-0 pr-0.5 text-right text-[10px] font-medium text-muted-foreground">
                  {day}
                </span>
                {Array.from({ length: 24 }, (_, h) => {
                  const count = row[h] ?? 0;
                  const level = bucket(stats.maxVal > 0 ? count / stats.maxVal : 0);
                  return (
                    <div
                      key={h}
                      className={`h-[14px] w-[14px] cursor-default rounded-[3px] transition-transform hover:scale-125 hover:ring-2 hover:ring-foreground/20 sm:h-[20px] sm:w-[20px] ${
                        level >= 4 ? "heat-pattern-high" : ""
                      }`}
                      style={{ backgroundColor: heatBg(level) }}
                      onMouseEnter={(e) =>
                        onEnter(
                          e,
                          `${day} ${pad2(h)}:00 — ${count} ${t("dashboard.heatOrders")}`,
                        )
                      }
                      onMouseLeave={onLeave}
                    />
                  );
                })}
              </div>
            );
          })}

          {/* Legend */}
          <div className="pt-2 pl-9">
            <HeatLegend minLabel="0" maxLabel={String(stats.maxVal)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Revenue Tab
// ═══════════════════════════════════════════════════════════════

function RevenueTab({
  data,
  onEnter,
  onLeave,
}: { data: Record<string, number> } & CellHoverHandlers) {
  const { t } = useTranslation();

  const { entries, total, avg, maxVal, maxDate, avgPct } = useMemo(() => {
    const ents = Object.entries(data).sort(([a], [b]) => a.localeCompare(b));
    const vals = ents.map(([, v]) => v);
    const sum = vals.reduce((a, b) => a + b, 0);
    const mx = Math.max(...vals, 0);
    const md = ents.find(([, v]) => v === mx)?.[0] ?? "";
    return {
      entries: ents,
      total: sum,
      avg: ents.length > 0 ? sum / ents.length : 0,
      maxVal: mx,
      maxDate: md,
      avgPct: mx > 0 ? sum / ents.length / mx : 0,
    };
  }, [data]);

  if (entries.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.noRevenueData")}
        description={t("dashboard.noRevenueDataDesc")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-2">
        <StatPill label={t("common.total")} value={formatCurrency(total)} />
        <StatPill label={t("dashboard.heatAverage")} value={formatCurrency(avg)} />
        <StatPill
          label={t("dashboard.heatBestDay")}
          value={maxDate ? formatDateShort(maxDate) : "—"}
        />
      </div>

      {/* Bars with average line */}
      <div className="relative min-h-[200px] space-y-1">
        {entries.map(([date, amount]) => {
          const pct = maxVal > 0 ? (amount / maxVal) * 100 : 0;
          const isPeak = amount === maxVal && maxVal > 0;
          return (
            <div key={date} className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {formatDateShort(date)}
              </span>
              <div className="relative h-5 min-w-0 flex-1">
                <div
                  className={`absolute inset-y-0 left-0 cursor-default rounded-[3px] transition-all hover:brightness-110 ${
                    isPeak
                      ? "bg-gradient-to-r from-brand-600 to-brand-800"
                      : "bg-gradient-to-r from-brand-600 to-brand-700"
                  }`}
                  style={{ width: `${Math.max(pct, 1.5)}%` }}
                  onMouseEnter={(e) =>
                    onEnter(e, `${formatDateShort(date)} — ${formatCurrency(amount)}`)
                  }
                  onMouseLeave={onLeave}
                />
                {isPeak && (
                  <span className="absolute inset-y-0 left-1.5 flex items-center text-[8px] font-bold uppercase tracking-wide text-white/90">
                    {t("dashboard.heatPeak")}
                  </span>
                )}
                <span className="pointer-events-none absolute inset-y-0 right-1.5 flex items-center text-[9px] font-semibold tabular-nums text-muted-foreground">
                  {formatCurrency(amount)}
                </span>
              </div>
            </div>
          );
        })}

        {/* Average line overlay */}
        {avgPct > 0 && (
          <div
            className="pointer-events-none absolute bottom-0 top-0 z-10 border-l-2 border-dashed border-primary/60"
            style={{
              left: `calc(3.5rem + 0.5rem + (100% - 3.5rem - 0.5rem) * ${avgPct})`,
            }}
          >
            <span className="absolute -top-4 left-0 -translate-x-1/2 whitespace-nowrap rounded bg-primary px-1 py-0.5 text-[8px] font-bold text-primary-foreground">
              AVG
            </span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 rounded-[2px] bg-gradient-to-r from-brand-600 to-brand-800" />
          <span className="text-[10px] text-muted-foreground">
            {t("dashboard.heatPeak")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-0 border-l-2 border-dashed border-primary/60" />
          <span className="text-[10px] text-muted-foreground">
            {t("dashboard.heatAverage")}
          </span>
        </div>
        <span className="ml-auto text-[10px] font-medium tabular-nums text-muted-foreground">
          {entries.length}{" "}
          {entries.length === 1
            ? t("dashboard.heatDay")
            : t("dashboard.heatDays")}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Customer Visits Tab
// ═══════════════════════════════════════════════════════════════

function CustomersTab({
  data,
  onEnter,
  onLeave,
}: { data: HeatmapData["customerVisits"] } & CellHoverHandlers) {
  const { t } = useTranslation();

  const { sorted, globalMax, topCustomer } = useMemo(() => {
    const s = [...data].sort((a, b) => b.totalOrders - a.totalOrders);
    let gm = 0;
    for (const c of s) {
      for (const v of c.dayDistribution) {
        if (v > gm) gm = v;
      }
    }
    return { sorted: s, globalMax: gm, topCustomer: s[0] };
  }, [data]);

  if (sorted.length === 0) {
    return (
      <EmptyState
        title={t("dashboard.noCustomerData")}
        description={t("dashboard.noCustomerDataDesc")}
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-2">
        <StatPill
          label={t("dashboard.heatActiveCustomers")}
          value={String(sorted.length)}
        />
        <StatPill
          label={t("dashboard.heatTopCustomer")}
          value={
            topCustomer
              ? `${topCustomer.name} (${topCustomer.totalOrders})`
              : "—"
          }
        />
      </div>

      {/* Grid */}
      <div className="overflow-x-auto">
        <div className="min-w-[320px]">
          {/* Day labels */}
          <div className="mb-1 flex items-center gap-[2px]">
            <span className="w-20 shrink-0" />
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                className="min-w-[28px] flex-1 text-center text-[9px] font-medium text-muted-foreground"
              >
                {d}
              </div>
            ))}
            <span className="w-10 shrink-0 text-center text-[9px] font-medium text-muted-foreground">
              {t("common.total")}
            </span>
          </div>

          {/* Rows */}
          {sorted.map((customer, idx) => {
            const isTop = idx === 0;
            return (
              <div
                key={customer.customerId}
                className={`mb-1 flex items-center gap-[2px] rounded-md ${
                  isTop ? "bg-brand-600/5 px-1 -mx-1" : ""
                }`}
              >
                <div className="flex w-20 shrink-0 items-center gap-1 pr-1">
                  <span className="w-3 text-[9px] font-bold tabular-nums text-muted-foreground">
                    {idx + 1}
                  </span>
                  <span
                    className="flex-1 truncate text-[10px] font-medium"
                    title={customer.name}
                  >
                    {customer.name}
                  </span>
                </div>
                {customer.dayDistribution.map((count, dow) => {
                  const level = bucket(
                    globalMax > 0 ? count / globalMax : 0,
                  );
                  return (
                    <div
                      key={dow}
                      className={`flex h-5 min-w-[28px] flex-1 cursor-default items-center justify-center rounded-[3px] text-[9px] font-medium transition-transform hover:scale-110 ${
                        level >= 4 ? "heat-pattern-high" : ""
                      } ${level >= 3 ? "text-white" : "text-muted-foreground"}`}
                      style={{ backgroundColor: heatBg(level) }}
                      onMouseEnter={(e) =>
                        onEnter(
                          e,
                          `${customer.name} — ${DAY_LABELS[dow]}: ${count} ${t("dashboard.heatOrders")}`,
                        )
                      }
                      onMouseLeave={onLeave}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  );
                })}
                <span className="w-10 shrink-0 text-center text-[10px] font-bold tabular-nums">
                  {customer.totalOrders}
                </span>
              </div>
            );
          })}

          {/* Legend */}
          <div className="pt-2">
            <HeatLegend minLabel="0" maxLabel={String(globalMax)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Main Component
// ═══════════════════════════════════════════════════════════════

interface Props {
  heatmap: HeatmapData;
}

export function HeatmapCard({ heatmap }: Props) {
  const { t } = useTranslation();
  const [hover, setHover] = useState<HoverInfo | null>(null);

  function cellEnter(e: React.MouseEvent<HTMLElement>, text: string) {
    const rect = e.currentTarget.getBoundingClientRect();
    setHover({ x: rect.left + rect.width / 2, y: rect.top, text });
  }

  function clearHover() {
    setHover(null);
  }

  return (
    <>
      <Card className="border border-border/40 bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-bold">
            {t("dashboard.activityHeatmaps")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="busy-hours">
            <TabsList className="mb-4">
              <TabsTrigger value="busy-hours">
                {t("dashboard.busyHours")}
              </TabsTrigger>
              <TabsTrigger value="revenue">{t("common.revenue")}</TabsTrigger>
              <TabsTrigger value="customers">
                {t("dashboard.customers")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="busy-hours">
              <BusyHoursTab
                data={heatmap.hourlyByDay}
                onEnter={cellEnter}
                onLeave={clearHover}
              />
            </TabsContent>

            <TabsContent value="revenue">
              <RevenueTab
                data={heatmap.revenueByDay}
                onEnter={cellEnter}
                onLeave={clearHover}
              />
            </TabsContent>

            <TabsContent value="customers">
              <CustomersTab
                data={heatmap.customerVisits}
                onEnter={cellEnter}
                onLeave={clearHover}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Styled hover tooltip (fixed-positioned, follows hovered cell) */}
      {hover && (
        <div
          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-lg"
          style={{ left: hover.x, top: hover.y - 8 }}
        >
          {hover.text}
        </div>
      )}
    </>
  );
}
