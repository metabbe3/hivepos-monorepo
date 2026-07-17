import { apiFetch } from "@/modules/shared";

export interface PickupInsights {
  totalAll: number;
  totalRejected: number;
  rejectionRate: number;
  topReasons: { reason: string; count: number; pct: number }[];
  topTenantsByRate: {
    tenantId: string;
    tenantName: string;
    rejected: number;
    total: number;
    rate: number;
  }[];
  topBranchesByRate: {
    tenantId: string;
    tenantName: string;
    branchName: string;
    rejected: number;
    total: number;
    rate: number;
  }[];
}

// Safe default so the insights page always renders (super-admin panel auth is still
// "later wave"; if the server-side fetch can't auth, we show zeros instead of crashing).
function emptyInsights(): PickupInsights {
  return {
    totalAll: 0,
    totalRejected: 0,
    rejectionRate: 0,
    topReasons: [],
    topTenantsByRate: [],
    topBranchesByRate: [],
  };
}

// Accept Date (what parseDateRange returns) or string; format to YYYY-MM-DD for the API.
function toDay(d: Date | string): string {
  if (typeof d === "string") return d;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function getPickupInsights(
  opts?: { from?: Date | string; to?: Date | string },
): Promise<PickupInsights> {
  try {
    const qs = new URLSearchParams();
    if (opts?.from) qs.set("from", toDay(opts.from));
    if (opts?.to) qs.set("to", toDay(opts.to));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    const { data } = await apiFetch<PickupInsights>(
      `/api/super-admin/pickup-insights${suffix}`,
    );
    return data ?? emptyInsights();
  } catch {
    return emptyInsights();
  }
}
