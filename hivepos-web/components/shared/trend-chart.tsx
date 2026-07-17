"use client";

import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";

export interface ChartLine {
  dataKey: string;
  color: string;
  name: string;
  type?: "line" | "bar";
  dashed?: boolean;
  yAxisId?: "left" | "right";
}

interface TrendChartProps {
  data: Record<string, unknown>[];
  lines: ChartLine[];
  xAxisKey?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

export function TrendChart({
  data,
  lines,
  xAxisKey = "date",
  height,
  formatValue = (v) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v),
}: TrendChartProps) {
  const isMobile = useIsMobile();
  if (!data || data.length === 0) return null;

  const hasRightAxis = lines.some((l) => l.yAxisId === "right");
  // ponytail: mobile chart squishes badly at 375px with the desktop defaults
  // (55px+35px axis widths, 20px bars, every-date X labels). These values keep
  // the chart legible on phones without touching desktop rendering.
  const chartHeight = height ?? (isMobile ? 240 : 320);
  const tickFont = isMobile ? 10 : 11;

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <ComposedChart
        data={data}
        margin={{
          top: 5,
          right: isMobile ? (hasRightAxis ? 12 : 8) : hasRightAxis ? 30 : 20,
          bottom: 5,
          left: isMobile ? 0 : 10,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey={xAxisKey}
          tick={{ fontSize: tickFont }}
          interval="preserveStartEnd"
          minTickGap={isMobile ? 16 : 8}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return isNaN(d.getTime())
              ? v
              : `${d.getDate()}/${d.getMonth() + 1}`;
          }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: tickFont }}
          tickFormatter={(v: number) => {
            if (Math.abs(v) >= 1_000_000)
              return `${(v / 1_000_000).toFixed(1)}jt`;
            if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}rb`;
            return String(v);
          }}
          width={isMobile ? 40 : 55}
        />
        {hasRightAxis && (
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: tickFont }}
            width={isMobile ? 28 : 35}
            allowDecimals={false}
          />
        )}
        <Tooltip
          formatter={(value: unknown, name: unknown, props: unknown) => {
            const line = lines.find((l) => l.dataKey === (props as { dataKey?: string })?.dataKey);
            if (line?.yAxisId === "right") return [String(value), String(name)];
            return [formatValue(Number(value)), String(name)];
          }}
          labelFormatter={(label) => {
            const d = new Date(String(label));
            return isNaN(d.getTime())
              ? String(label)
              : d.toLocaleDateString("id-ID", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                });
          }}
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid var(--color-border)",
            background: "var(--color-card)",
            fontSize: "12px",
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: isMobile ? "11px" : "12px", paddingTop: "8px" }}
          iconSize={isMobile ? 8 : 14}
        />
        {lines.map((line) => {
          const yId = line.yAxisId ?? "left";
          if (line.type === "bar") {
            return (
              <Bar
                key={line.dataKey}
                dataKey={line.dataKey}
                fill={line.color}
                name={line.name}
                yAxisId={yId}
                opacity={0.6}
                barSize={isMobile ? 8 : 20}
              />
            );
          }
          return (
            <Line
              key={line.dataKey}
              type="monotone"
              dataKey={line.dataKey}
              stroke={line.color}
              name={line.name}
              strokeWidth={2}
              dot={{ r: isMobile ? 0 : 3 }}
              activeDot={{ r: isMobile ? 4 : 5 }}
              strokeDasharray={line.dashed ? "5 5" : undefined}
              yAxisId={yId}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
}
