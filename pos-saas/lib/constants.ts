import type { OrderStatus, PaymentStatus, PaymentMethod, PricingType, CommissionType, StockMovementType, DepositTransactionType } from "@/app/generated/prisma/enums";

export const BUSINESS_NAME_KEY = "app.title";
export const BUSINESS_TAGLINE_KEY = "app.tagline";

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { labelKey: string; color: string }> = {
  RECEIVED: { labelKey: "status.received", color: "bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  IN_PROGRESS: { labelKey: "status.inProgress", color: "bg-amber-100/80 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  READY: { labelKey: "status.ready", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  DELIVERED: { labelKey: "status.delivered", color: "bg-stone-100/80 text-stone-500 dark:bg-stone-800/50 dark:text-stone-400" },
  CANCELED: { labelKey: "status.canceled", color: "bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { labelKey: string; color: string }> = {
  PENDING: { labelKey: "status.unpaid", color: "bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  PARTIAL: { labelKey: "status.partial", color: "bg-orange-100/80 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300" },
  PAID: { labelKey: "status.paid", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  REFUNDED: { labelKey: "status.refunded", color: "bg-slate-100/80 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400" },
};

/**
 * Payment statuses that still have an outstanding balance. Single source of
 * truth for the `{ in: [...] }` Prisma filter used across dashboard/reports.
 */
export const UNPAID_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PARTIAL"];

/**
 * How long order proof photos live before auto-delete. 7 days aligns with the
 * short end of the laundry damage-claim window (industry: 7–14d) and keeps
 * total disk bounded (≤ 7 days × daily volume). Single source — adopted by
 * lib/photo-cleanup.ts + the upload route.
 */
export const PHOTO_TTL_DAYS = 7;

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "paymentMethod.cash",
  DEPOSIT: "paymentMethod.deposit",
  QRIS: "paymentMethod.qris",
  TRANSFER: "paymentMethod.transfer",
};

export const PRICING_TYPE_LABELS: Record<PricingType, string> = {
  PER_KG: "pricingType.perKg",
  PER_ITEM: "pricingType.perItem",
  FLAT: "pricingType.flat",
};

export type GarmentGroup = "tops" | "bottoms" | "underwear" | "bath" | "household";

export interface GarmentCategory {
  id: string;
  labelKey: string;
  group: GarmentGroup;
  keywords: string[];
}

/** Ordered groups — drives the section headers in the PER_KG garment picker. */
export const GARMENT_GROUPS: { id: GarmentGroup; labelKey: string }[] = [
  { id: "tops", labelKey: "garment.group.tops" },
  { id: "bottoms", labelKey: "garment.group.bottoms" },
  { id: "underwear", labelKey: "garment.group.underwear" },
  { id: "bath", labelKey: "garment.group.bath" },
  { id: "household", labelKey: "garment.group.household" },
];

export const DEFAULT_GARMENT_CATEGORIES: GarmentCategory[] = [
  { id: "shirts", labelKey: "garment.shirts", group: "tops", keywords: ["baju", "kaos", "kemeja", "shirt"] },
  { id: "shorts", labelKey: "garment.shorts", group: "bottoms", keywords: ["celana pendek", "short pants"] },
  { id: "pants", labelKey: "garment.pants", group: "bottoms", keywords: ["celana panjang", "trousers", "jeans"] },
  { id: "skirt", labelKey: "garment.skirt", group: "bottoms", keywords: ["rok"] },
  { id: "underwear", labelKey: "garment.underwear", group: "underwear", keywords: ["cd", "celana dalam"] },
  { id: "bra", labelKey: "garment.bra", group: "underwear", keywords: ["bra"] },
  { id: "socks", labelKey: "garment.socks", group: "underwear", keywords: ["kaos kaki"] },
  { id: "towel", labelKey: "garment.towel", group: "bath", keywords: ["handuk"] },
  { id: "fabric", labelKey: "garment.fabric", group: "bath", keywords: ["kain", "sarung", "sarong"] },
  { id: "prayerGarment", labelKey: "garment.prayerGarment", group: "bath", keywords: ["mukenah", "mukena"] },
  { id: "scarf", labelKey: "garment.scarf", group: "bath", keywords: ["kerudung", "hijab", "veil"] },
  { id: "schoolUniform", labelKey: "garment.schoolUniform", group: "household", keywords: ["seragam", "sekolah"] },
  { id: "pillowCover", labelKey: "garment.pillowCover", group: "household", keywords: ["sarung bantal", "guling", "sarung guling"] },
  { id: "gloves", labelKey: "garment.gloves", group: "household", keywords: ["sarung tangan"] },
  { id: "others", labelKey: "garment.others", group: "household", keywords: ["lain lain", "lainnya"] },
];

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  NONE: "commissionType.none",
  FLAT: "commissionType.flat",
  PERCENTAGE: "commissionType.percentage",
};

export const ORDER_STATUS_FLOW: OrderStatus[] = ["RECEIVED", "IN_PROGRESS", "READY", "DELIVERED"];

export type CustomerStatus = "ACTIVE" | "AT_RISK" | "LAPSED" | "NEW";

export const CUSTOMER_STATUS_CONFIG: Record<CustomerStatus, { labelKey: string; color: string }> = {
  ACTIVE: { labelKey: "status.active", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  AT_RISK: { labelKey: "status.atRisk", color: "bg-amber-100/80 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  LAPSED: { labelKey: "status.lapsed", color: "bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  NEW: { labelKey: "status.new", color: "bg-sky-100/80 text-sky-600 dark:bg-sky-900/40 dark:text-sky-300" },
};

export const DATE_RANGE_PRESETS = [
  { labelKey: "dateRange.today", key: "today" },
  { labelKey: "dateRange.yesterday", key: "yesterday" },
  { labelKey: "dateRange.thisWeek", key: "thisWeek" },
  { labelKey: "dateRange.lastWeek", key: "lastWeek" },
  { labelKey: "dateRange.thisMonth", key: "thisMonth" },
  { labelKey: "dateRange.lastMonth", key: "lastMonth" },
  { labelKey: "dateRange.custom", key: "custom" },
] as const;

export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number]["key"];

export function getDateRangePreset(key: DateRangePreset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayOfWeek = today.getDay();
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((dayOfWeek + 6) % 7));

  switch (key) {
    case "today":
      return { from: fmt(today), to: fmt(today) };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { from: fmt(y), to: fmt(y) };
    }
    case "thisWeek":
      return { from: fmt(monday), to: fmt(today) };
    case "lastWeek": {
      const lastMonday = new Date(monday);
      lastMonday.setDate(lastMonday.getDate() - 7);
      const lastSunday = new Date(monday);
      lastSunday.setDate(lastSunday.getDate() - 1);
      return { from: fmt(lastMonday), to: fmt(lastSunday) };
    }
    case "thisMonth":
      return { from: fmt(new Date(today.getFullYear(), today.getMonth(), 1)), to: fmt(today) };
    case "lastMonth": {
      const firstOfLast = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastOfLast = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: fmt(firstOfLast), to: fmt(lastOfLast) };
    }
    default:
      return { from: fmt(startOfDay(today)), to: fmt(today) };
  }
}

export const STOCK_MOVEMENT_TYPE_CONFIG: Record<StockMovementType, { labelKey: string; color: string }> = {
  IN: { labelKey: "reports.in", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  OUT: { labelKey: "reports.out", color: "bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  ADJUSTMENT: { labelKey: "reports.adjustment", color: "bg-amber-100/80 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

export const DEPOSIT_TRANSACTION_TYPE_CONFIG: Record<DepositTransactionType, { labelKey: string; color: string }> = {
  TOP_UP: { labelKey: "deposit.topUp", color: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  DEDUCTION: { labelKey: "deposit.deduction", color: "bg-red-100/80 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
  REFUND: { labelKey: "deposit.refund", color: "bg-sky-100/80 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300" },
  ADJUSTMENT: { labelKey: "deposit.adjustment", color: "bg-amber-100/80 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
};

export interface ServiceCategory {
  id: string;
  labelKey: string;
  keywords: string[];
  exclude?: string[];
  fallback?: boolean;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = [
  { id: "all", labelKey: "serviceCategories.all", keywords: [] },
  { id: "wash-fold", labelKey: "serviceCategories.washFold", keywords: ["Cuci Dan Lipat", "Keringin"] },
  { id: "wash-iron", labelKey: "serviceCategories.washIron", keywords: ["Cuci Dan Setrika"] },
  { id: "iron", labelKey: "serviceCategories.iron", keywords: ["Setrika"], exclude: ["Cuci Dan Setrika"] },
  { id: "tops", labelKey: "serviceCategories.tops", keywords: ["Kaos", "Kemeja", "Blouse", "Dress", "Jas", "Rompi", "Dasi", "Selendang", "Topi", "Seragam", "Batik"] },
  { id: "bottoms", labelKey: "serviceCategories.bottoms", keywords: ["Celana", "Rok", "Jeans"], exclude: ["Celana Dalam"] },
  { id: "underwear", labelKey: "serviceCategories.underwear", keywords: ["Bra", "CD /", "Celana Dalam", "Underwear", "Kaos Kaki"] },
  { id: "jackets", labelKey: "serviceCategories.jackets", keywords: ["Jaket", "Sweater"] },
  { id: "shoes", labelKey: "serviceCategories.shoes", keywords: ["Sepatu"] },
  { id: "bedding", labelKey: "serviceCategories.bedding", keywords: ["Bed Cover", "Bedcover", "Sprei", "Cover Bed"] },
  { id: "blankets", labelKey: "serviceCategories.blankets", keywords: ["Selimut", "Handuk", "Bantal"] },
  { id: "carpets", labelKey: "serviceCategories.carpets", keywords: ["Boneka", "Karpet", "Keset", "Taplak"] },
  { id: "others", labelKey: "serviceCategories.others", keywords: [], fallback: true },
];

export function getServiceCategory(name: string): string {
  for (const cat of SERVICE_CATEGORIES) {
    if (cat.id === "all" || cat.fallback) continue;
    const matchesKeyword = cat.keywords.some((kw) => name.toLowerCase().includes(kw.toLowerCase()));
    const excluded = cat.exclude?.some((ex) => name.toLowerCase().includes(ex.toLowerCase())) ?? false;
    if (matchesKeyword && !excluded) return cat.id;
  }
  return "others";
}

export function getServicesByCategory(services: { name: string }[]): Record<string, { name: string }[]> {
  const grouped: Record<string, { name: string }[]> = {};
  for (const cat of SERVICE_CATEGORIES) {
    if (cat.id === "all") continue;
    grouped[cat.id] = [];
  }
  for (const svc of services) {
    const catId = getServiceCategory(svc.name);
    if (!grouped[catId]) grouped[catId] = [];
    grouped[catId].push(svc);
  }
  return grouped;
}
