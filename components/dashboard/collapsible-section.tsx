"use client";

import { useState, useEffect, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import type { LucideIcon } from "lucide-react";

// ponytail: localStorage holds a per-section open/closed map. Initial render
// uses defaultOpen (no flash for the common case); effect reconciles to the
// stored preference after mount. Per-device, not synced — fine for a
// personal dashboard view.

const STORAGE_KEY = "dashboard.sectionCollapse.v1";

function readStored(id: string): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state = JSON.parse(raw) as Record<string, boolean>;
    return typeof state[id] === "boolean" ? state[id] : null;
  } catch {
    return null;
  }
}

function writeStored(id: string, open: boolean) {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const state = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    state[id] = open;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // quota / disabled storage — silently skip, UI still works in-session.
  }
}

export function CollapsibleSection({
  id,
  title,
  icon: Icon,
  defaultOpen = true,
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = readStored(id);
    if (stored !== null) setOpen(stored);
  }, [id]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      writeStored(id, next);
      return next;
    });
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={toggle}
          aria-label={open ? t("dashboard.sections.collapse") : t("dashboard.sections.expand")}
          aria-expanded={open}
          aria-controls={`section-${id}`}
          className="h-7 gap-1 px-2 text-xs text-muted-foreground"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
          {open ? t("dashboard.sections.collapse") : t("dashboard.sections.expand")}
        </Button>
      </div>
      {open && (
        <div id={`section-${id}`} className="space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}
