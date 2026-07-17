"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DATE_RANGE_PRESETS, getDateRangePreset } from "@/lib/constants";
import type { DateRangePreset } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";

interface DateRangePickerProps {
  from: string;
  to: string;
  onFromChange: (date: string) => void;
  onToChange: (date: string) => void;
}

export function DateRangePicker({ from, to, onFromChange, onToChange }: DateRangePickerProps) {
  const { t } = useTranslation();
  const [customActive, setCustomActive] = useState(false);

  const activePreset = !customActive
    ? DATE_RANGE_PRESETS.find((p) => {
        if (p.key === "custom") return false;
        const range = getDateRangePreset(p.key);
        return range.from === from && range.to === to;
      })
    : null;

  function applyPreset(key: DateRangePreset) {
    if (key === "custom") {
      setCustomActive(true);
      return;
    }
    setCustomActive(false);
    const range = getDateRangePreset(key);
    onFromChange(range.from);
    onToChange(range.to);
  }

  return (
    <div className="space-y-3 w-full">
      {/* Horizontal scrollable presets on mobile, wrap on desktop */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1 pb-1">
        {DATE_RANGE_PRESETS.map((p) => {
          const isActive = p.key === "custom"
            ? customActive
            : !customActive && activePreset?.key === p.key;
          return (
            <Button
              key={p.key}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="text-xs h-8 shrink-0"
              onClick={() => applyPreset(p.key)}
            >
              {t(p.labelKey)}
            </Button>
          );
        })}
      </div>
      {customActive && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <Input type="date" value={from} onChange={(e) => onFromChange(e.target.value)} className="w-full sm:w-[150px]" />
          <span className="text-muted-foreground text-sm text-center sm:text-left">{t("common.to")}</span>
          <Input type="date" value={to} onChange={(e) => onToChange(e.target.value)} className="w-full sm:w-[150px]" />
        </div>
      )}
    </div>
  );
}
