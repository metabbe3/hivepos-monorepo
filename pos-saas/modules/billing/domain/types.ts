/**
 * Billing domain types.
 *
 * The pure pricing / coverage / promo / limit logic lives in `lib/billing.ts`
 * and is consumed directly by application services. This module re-exports the
 * relevant types and constants so domain code imports from a single place, and
 * defines the persistence-shaped types used by the repository port.
 */

export type {
  OutletStatus,
  OutletCoverage,
  OutletCoverageSummary,
  PromoValidationResult,
  BillCalculation,
  LimitType,
  LimitCheckResult,
  TenantPlan,
} from "@/lib/billing";

export {
  PRICE_PER_OUTLET,
  ORIGINAL_PRICE_PER_OUTLET,
  PRO_PRICE_PER_OUTLET,
  FREE_TIER,
  addMonths,
  calculateBill,
  getTenantPlan,
  getTierUnitPrice,
} from "@/lib/billing";

// ── Persistence-shaped types (no Prisma import) ────────────────────────

export type SubscriptionStatus =
  | "TRIAL"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "EXPIRED";

export type SaaSPaymentStatus = "PENDING" | "PAID" | "FAILED";

export type PromoType = "FREE_MONTH" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED";

/** Promo code as returned by the repository (Prisma PromoCode mapped). */
export interface PromoCodeRecord {
  id: string;
  code: string;
  description: string | null;
  type: PromoType;
  value: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  validFrom: Date | null;
  validUntil: Date | null;
  isActive: boolean;
  applicablePlan: string | null;
}

/** Branch info used by checkout validation. */
export interface BranchCoverageInfo {
  id: string;
  name: string;
  isFreeTier: boolean;
  coverageEnd: Date | null;
}

/** Tenant info returned by the status query. */
export interface TenantInfo {
  name: string;
  slug: string;
  ownerEmail: string;
  trialEndsAt: Date | null;
  activeModules: string[];
}

/** Subscription cache info returned by the status query. */
export interface SubscriptionInfo {
  status: SubscriptionStatus;
  planName: string;
  currentPeriodEnd: Date | null;
}

/** SaaS payment record (Decimals converted to number). */
export interface SaaSPaymentRecord {
  id: string;
  tenantId: string;
  amount: number;
  outletCount: number;
  monthsPurchased: number;
  status: SaaSPaymentStatus;
  kind: string;
  branchIds: string[];
  promoCodeId: string | null;
  midtransOrderId: string | null;
  midtransSnapToken: string | null;
  paidAt: Date | null;
  createdAt: Date;
}

/** Data needed to create a new SaaS payment. */
export interface CreatePaymentData {
  tenantId: string;
  amount: number;
  outletCount: number;
  unitPrice: number;
  monthsPurchased: number;
  promoCodeId: string | null;
  midtransOrderId: string;
  status: SaaSPaymentStatus;
  kind: string;
  branchIds: string[];
}

export interface TenantLimits {
  maxOutlets: number;
  maxUsers: number;
  maxOrders: number;
  isPaid: boolean;
  planName: string;
}

/** Midtrans snap transaction input/output. */
export interface SnapTransactionParams {
  orderId: string;
  amount: number;
  tenantName: string;
  ownerEmail: string;
  months: number;
  outletCount: number;
}

export interface SnapTransactionResult {
  snapToken: string;
  redirectUrl: string;
}

export interface MidtransNotification {
  orderId: string;
  transactionStatus: string;
  fraudStatus?: string;
  grossAmount?: string;
  statusCode?: string;
  signatureKey?: string;
}
