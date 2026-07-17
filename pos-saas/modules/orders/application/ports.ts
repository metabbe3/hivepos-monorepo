import type { ServicePricing, BusinessModule } from "../domain/types";

/**
 * Read-only access to the Service catalog (for pricing lookups during order
 * creation/update). Lives outside the Order aggregate so it gets its own port.
 */
export interface ServiceCatalogPort {
  /** Fetch pricing snapshots for the given service ids. */
  findPricingForServices(
    ids: string[],
    branchIds: string[],
  ): Promise<ServicePricing[]>;
}

/** Branch coverage info used for the "outlet locked" guard. */
export interface BranchCoverageInfo {
  id: string;
  isFreeTier: boolean;
  coverageEnd: Date | null;
}

export interface BranchPort {
  getCoverage(branchId: string): Promise<BranchCoverageInfo | null>;
}

/** Result of a free-tier limit check. */
export interface OrderLimitResult {
  allowed: boolean;
  current: number;
  max: number;
  reason?: string;
}

export interface OrderLimitPort {
  checkOrderLimit(tenantId: string): Promise<OrderLimitResult>;
}

/**
 * Read-only access to tenant fields needed by the order service — currently
 * just the slug (used to derive the tenant code prefix on order numbers).
 */
export interface TenantPort {
  getSlug(tenantId: string): Promise<string | null>;
}

/** Resolves the active business module from a lowercase session value. */
export interface ModuleResolver {
  resolve(): BusinessModule;
}

/**
 * Customer existence check scoped to a branch. Used by CreateOrderService to
 * confirm the supplied customerId actually belongs to the caller's branch —
 * closes the cross-tenant customer-spoofing gap (a tampered offline payload
 * could otherwise point at another tenant's customer).
 */
export interface CustomerLookupPort {
  existsInBranch(customerId: string, branchId: string): Promise<boolean>;
}
