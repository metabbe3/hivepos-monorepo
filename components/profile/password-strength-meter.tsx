"use client";

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";
import type { PasswordRequirement, StrengthResult } from "./types";

/**
 * Calculate password strength on a 0–4 scale.
 *   +1 length ≥ 8
 *   +1 has uppercase AND lowercase
 *   +1 has a digit
 *   +1 has a special character
 */
export function calcStrength(password: string): StrengthResult {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const clamped = Math.min(score, 4) as StrengthResult["score"];

  if (clamped <= 1) {
    return {
      score: clamped,
      segmentClass: "bg-red-500",
      labelKey: "profile.strengthWeak",
    };
  }
  if (clamped === 2) {
    return {
      score: clamped,
      segmentClass: "bg-amber-500",
      labelKey: "profile.strengthFair",
    };
  }
  if (clamped === 3) {
    return {
      score: clamped,
      segmentClass: "bg-sky-500",
      labelKey: "profile.strengthGood",
    };
  }
  return {
    score: clamped,
    segmentClass: "bg-emerald-500",
    labelKey: "profile.strengthStrong",
  };
}

/** Build the requirements checklist for a given password. */
export function getRequirements(password: string): PasswordRequirement[] {
  return [
    { labelKey: "profile.reqLength", met: password.length >= 8 },
    { labelKey: "profile.reqUpper", met: /[A-Z]/.test(password) },
    { labelKey: "profile.reqLower", met: /[a-z]/.test(password) },
    { labelKey: "profile.reqNumber", met: /\d/.test(password) },
    { labelKey: "profile.reqSpecial", met: /[^A-Za-z0-9]/.test(password) },
  ];
}

const LABEL_COLORS: Record<number, string> = {
  0: "text-red-600 dark:text-red-400",
  1: "text-red-600 dark:text-red-400",
  2: "text-amber-600 dark:text-amber-400",
  3: "text-sky-600 dark:text-sky-400",
  4: "text-emerald-600 dark:text-emerald-400",
};

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({
  password,
}: PasswordStrengthMeterProps) {
  const { t } = useTranslation();
  const { score, segmentClass, labelKey } = calcStrength(password);
  const requirements = getRequirements(password);
  const labelColor = LABEL_COLORS[score];

  return (
    <div className="space-y-2">
      {/* 4 segments + label */}
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                i < score ? segmentClass : "bg-muted",
              )}
            />
          ))}
        </div>
        {password && (
          <span className={cn("text-xs font-semibold tabular-nums", labelColor)}>
            {t(labelKey)}
          </span>
        )}
      </div>

      {/* Requirements checklist */}
      <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
        {requirements.map((req) => (
          <li
            key={req.labelKey}
            className={cn(
              "flex items-center gap-1.5 text-[11px] transition-colors",
              req.met
                ? "font-medium text-emerald-600 dark:text-emerald-400"
                : "text-muted-foreground",
            )}
          >
            {req.met ? (
              <Check className="h-3 w-3 shrink-0" />
            ) : (
              <Circle className="h-2.5 w-2.5 shrink-0 opacity-50" />
            )}
            {t(req.labelKey)}
          </li>
        ))}
      </ul>
    </div>
  );
}
