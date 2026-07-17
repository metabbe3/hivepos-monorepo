"use client";

import { formatCurrency } from "@/lib/format";

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  valueFormatter,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  valueFormatter?: (value: number, name: string) => string;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const fmt = valueFormatter || ((v: number) => formatCurrency(v));

  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 shadow-md">
      {label && <p className="text-xs text-muted-foreground mb-1">{label}</p>}
      {payload.map((item, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span
            className="h-2 w-2 rounded-full shrink-0"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-semibold">{fmt(item.value, item.dataKey)}</span>
        </div>
      ))}
    </div>
  );
}
