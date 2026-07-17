import type { CustomerStatus } from "@/lib/constants";

export interface CustomerStatusColor {
  /** Accent strip gradient (Tailwind `from-X-500 to-X-600`). */
  gradient: string;
  /** Solid background used for the avatar circle when tying avatar to status. */
  avatarBg: string;
  /** Soft tinted background for inline highlights (chips, callouts). */
  softBg: string;
  /** Foreground text color matching the softBg tint. */
  softFg: string;
}

/**
 * Status → color mapping. Each status uses one hue family consistently across
 * the accent strip, soft tint backgrounds, and inline highlights. Badge classes
 * continue to come from CUSTOMER_STATUS_CONFIG in lib/constants.ts (source of truth).
 */
export const CUSTOMER_COLORS: Record<CustomerStatus, CustomerStatusColor> = {
  NEW: {
    gradient: "from-sky-500 to-sky-600",
    avatarBg: "bg-sky-500",
    softBg: "bg-sky-50 dark:bg-sky-950/40",
    softFg: "text-sky-700 dark:text-sky-300",
  },
  ACTIVE: {
    gradient: "from-emerald-500 to-emerald-600",
    avatarBg: "bg-emerald-500",
    softBg: "bg-emerald-50 dark:bg-emerald-950/40",
    softFg: "text-emerald-700 dark:text-emerald-300",
  },
  AT_RISK: {
    gradient: "from-amber-500 to-amber-600",
    avatarBg: "bg-amber-500",
    softBg: "bg-amber-50 dark:bg-amber-950/40",
    softFg: "text-amber-700 dark:text-amber-300",
  },
  LAPSED: {
    gradient: "from-red-500 to-red-600",
    avatarBg: "bg-red-500",
    softBg: "bg-red-50 dark:bg-red-950/40",
    softFg: "text-red-700 dark:text-red-300",
  },
};

/**
 * Broader palette used for the avatar's deterministic color (independent of
 * status). Two customers with the same status will share an accent strip but
 * get different avatar colors, creating visual variety in list views.
 */
export const AVATAR_PALETTE = [
  "bg-indigo-500",
  "bg-blue-500",
  "bg-emerald-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-teal-500",
  "bg-orange-500",
  "bg-cyan-500",
  "bg-pink-500",
] as const;

export function statusGradient(status: CustomerStatus): string {
  return CUSTOMER_COLORS[status].gradient;
}

export function statusAvatarBg(status: CustomerStatus): string {
  return CUSTOMER_COLORS[status].avatarBg;
}

/**
 * Deterministic palette index for a name. Uses the classic Java String
 * hashCode multiplier (31) which distributes well for short strings.
 */
export function avatarColorForName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}
