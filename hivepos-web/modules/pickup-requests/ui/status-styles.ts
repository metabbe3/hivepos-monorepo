/**
 * Shared UI constants for pickup request statuses.
 *
 * Imported by both the list page and detail dialog so colors/labels stay
 * consistent. Kept UI-only (no domain imports) so it can be safely imported
 * from client components.
 */

import type { PickupRequestStatus } from "../domain/types";

/** Tailwind classes for the pill-style badge. Includes dark mode variants. */
export const PICKUP_STATUS_BADGE: Record<PickupRequestStatus, string> = {
  PENDING: "bg-amber-100/80 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  ACCEPTED: "bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  SCHEDULED: "bg-indigo-100/80 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
  CONVERTED: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  REJECTED: "bg-rose-100/80 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  CANCELED: "bg-slate-100/80 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300",
};

/** Indonesian labels (single source of truth). */
export const PICKUP_STATUS_LABEL: Record<PickupRequestStatus, string> = {
  PENDING: "Menunggu",
  ACCEPTED: "Diterima",
  SCHEDULED: "Dijadwalkan",
  CONVERTED: "Jadi Order",
  REJECTED: "Ditolak",
  CANCELED: "Dibatalkan",
};
