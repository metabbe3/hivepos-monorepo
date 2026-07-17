"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useRole } from "@/hooks/use-role";
import { useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const MODULE_META: Record<string, { label: string; emoji: string }> = {
  laundry: { label: "Laundry", emoji: "🧺" },
  fnb: { label: "F&B", emoji: "🍽️" },
  salon: { label: "Salon", emoji: "💇" },
  cleaning: { label: "Cleaning", emoji: "🧽" },
};

export function ModuleSelector() {
  const { activeModule, activeModules } = useRole();
  const { update } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  const current = MODULE_META[activeModule] ?? MODULE_META.laundry;
  const hasMultiple = activeModules.length > 1;

  async function selectModule(mod: string) {
    if (mod === activeModule) return;
    setPending(mod);
    await update({ selectedModule: mod });
    // Navigate to /dashboard — it's the universal page that filters by
    // session module. Module-prefixed routes (/fnb/orders etc.) don't
    // exist yet; the laundry orders/services pages are module-aware via
    // the session and can be reached from the sidebar submenu.
    router.push("/dashboard");
    router.refresh();
    setPending(null);
  }

  // Single module — just show a static label
  if (!hasMultiple) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        <span className="text-sm leading-none">{current.emoji}</span>
        <span>{current.label}</span>
      </div>
    );
  }

  // Multiple modules — clickable dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            disabled={pending !== null}
            className="group flex items-center gap-1.5 rounded-md px-1.5 py-0.5 -ml-1.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase transition-colors hover:bg-sidebar-accent/60 hover:text-foreground disabled:opacity-50"
          />
        }
      >
        <span className="text-sm leading-none">{current.emoji}</span>
        <span>{pending === activeModule ? "…" : current.label}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50 transition-transform group-data-[popup-open]:rotate-180" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-[160px]">
        {activeModules.map((mod) => {
          const meta = MODULE_META[mod];
          if (!meta) return null;
          const isActive = mod === activeModule;
          return (
            <DropdownMenuItem
              key={mod}
              onClick={() => selectModule(mod)}
              className={isActive ? "font-semibold bg-accent/60" : ""}
            >
              <span className="text-base">{meta.emoji}</span>
              <span className="text-[13px]">{meta.label}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
