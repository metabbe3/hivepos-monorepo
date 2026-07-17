"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_COLORS } from "./colors";

interface ColorSwatchPickerProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export function ColorSwatchPicker({
  value,
  onChange,
  disabled,
}: ColorSwatchPickerProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLE_COLORS.map((c) => {
        const selected = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(c.value)}
            title={c.label}
            aria-label={c.label}
            aria-pressed={selected}
            className={cn(
              "relative h-8 w-8 rounded-lg transition-transform active:scale-90",
              "ring-2 ring-offset-2 ring-offset-background",
              "focus-visible:outline-none focus-visible:ring-foreground",
              selected
                ? "ring-foreground"
                : "ring-transparent hover:ring-border",
              c.class,
              disabled && "opacity-40",
            )}
          >
            {selected && (
              <Check className="absolute inset-0 m-auto h-4 w-4 text-white" />
            )}
          </button>
        );
      })}
    </div>
  );
}
