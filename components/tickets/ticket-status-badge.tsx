"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_STYLES: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  IN_PROGRESS: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  RESOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  CLOSED: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "border-zinc-300 text-zinc-500",
  NORMAL: "border-sky-300 text-sky-600",
  HIGH: "border-orange-300 text-orange-600",
  URGENT: "border-red-300 text-red-600",
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant="secondary" className={`text-[10px] font-medium ${STATUS_STYLES[status] ?? ""}`}>{status}</Badge>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <Badge variant="outline" className={`text-[10px] font-medium ${PRIORITY_STYLES[priority] ?? ""}`}>{priority}</Badge>;
}
