import { getServiceCategory } from "@/lib/constants";

export interface Service {
  id: string;
  name: string;
  pricingType: "PER_KG" | "PER_ITEM";
  basePrice: number;
  isActive: boolean;
  isDefaultSpeed: boolean;
  groupId: string | null;
  group: { id: string; name: string } | null;
}

export type SpeedType = "reguler" | "express24" | "express7" | "standalone";

export interface SpeedVariant {
  serviceId: string;
  name: string;
  basePrice: number;
  speed: SpeedType;
  isDefault: boolean;
}

export interface BaseItem {
  baseName: string;
  normalizedName: string;
  pricingType: "PER_KG" | "PER_ITEM";
  category: string;
  variants: SpeedVariant[];
  defaultServiceId: string;
  priceRange: { min: number; max: number };
}

// Regex to detect speed modifiers at the end of a service name
const SPEED_REGEX = /(?:\s+Express\s+(?:24\s+Jam|7\s+Jam))|(?:\s+Reguler)$/i;

// Normalize inconsistencies in base names
function normalizeBaseName(name: string): string {
  let normalized = name.trim();
  // "Bedcover" → "Bed Cover"
  normalized = normalized.replace(/^Bedcover/, "Bed Cover");
  // "Cover Bed King Size" → "Bed Cover King Size"
  normalized = normalized.replace(/^Cover Bed/, "Bed Cover");
  // Collapse multiple spaces
  normalized = normalized.replace(/\s{2,}/g, " ");
  return normalized.trim();
}

function detectSpeed(name: string): { baseName: string; speed: SpeedType } | null {
  const match = name.match(SPEED_REGEX);
  if (!match) return null;

  const baseName = name.slice(0, name.length - match[0].length).trim();
  const suffix = match[0].trim().toLowerCase();

  let speed: SpeedType = "reguler";
  if (suffix.includes("express 24 jam") || suffix.includes("express24 jam")) {
    speed = "express24";
  } else if (suffix.includes("express 7 jam") || suffix.includes("express7 jam")) {
    speed = "express7";
  }

  return { baseName, speed };
}

export function transformServices(services: Service[]): BaseItem[] {
  const groupMap = new Map<string, BaseItem>();

  for (const svc of services) {
    const detected = detectSpeed(svc.name);
    let baseName: string;
    let speed: SpeedType;

    if (detected) {
      baseName = normalizeBaseName(detected.baseName);
      speed = detected.speed;
    } else {
      baseName = normalizeBaseName(svc.name);
      speed = "standalone";
    }

    // Use normalizedName as the grouping key
    const key = `${baseName}::${svc.pricingType}`;

    if (!groupMap.has(key)) {
      groupMap.set(key, {
        baseName,
        normalizedName: baseName,
        pricingType: svc.pricingType,
        category: getServiceCategory(baseName),
        variants: [],
        defaultServiceId: svc.id,
        priceRange: { min: svc.basePrice, max: svc.basePrice },
      });
    }

    const group = groupMap.get(key)!;
    group.variants.push({
      serviceId: svc.id,
      name: svc.name,
      basePrice: svc.basePrice,
      speed,
      isDefault: svc.isDefaultSpeed,
    });

    // Update price range
    group.priceRange.min = Math.min(group.priceRange.min, svc.basePrice);
    group.priceRange.max = Math.max(group.priceRange.max, svc.basePrice);
  }

  // Set smart defaults and sort variants
  const baseItems = Array.from(groupMap.values());
  for (const item of baseItems) {
    // Sort: reguler first, then express24, then express7, then standalone
    const speedOrder: Record<SpeedType, number> = { reguler: 0, standalone: 1, express24: 2, express7: 3 };
    item.variants.sort((a, b) => speedOrder[a.speed] - speedOrder[b.speed]);

    // Default: owner-chosen flag wins, else reguler, else first variant.
    const flagged = item.variants.find((v) => v.isDefault);
    const reguler = item.variants.find((v) => v.speed === "reguler");
    item.defaultServiceId = (flagged ?? reguler ?? item.variants[0]).serviceId;
  }

  // Sort base items alphabetically by name
  baseItems.sort((a, b) => a.baseName.localeCompare(b.baseName));

  return baseItems;
}

export function getBaseItemCategories(baseItems: BaseItem[]): { id: string; count: number }[] {
  const categoryCounts = new Map<string, number>();
  for (const item of baseItems) {
    const cat = item.category;
    categoryCounts.set(cat, (categoryCounts.get(cat) || 0) + 1);
  }
  return Array.from(categoryCounts.entries()).map(([id, count]) => ({ id, count }));
}

export function filterBaseItems(
  baseItems: BaseItem[],
  search: string,
  categoryId: string
): BaseItem[] {
  return baseItems.filter((item) => {
    if (search && !item.baseName.toLowerCase().includes(search.toLowerCase())) return false;
    if (categoryId !== "all" && item.category !== categoryId) return false;
    return true;
  });
}
