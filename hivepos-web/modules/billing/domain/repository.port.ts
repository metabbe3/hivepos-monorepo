/**
 * Repository port for the billing domain.
 *
 * Infrastructure implementations wrap `lib/billing.ts` (coverage/limits/promo
 * logic) and Prisma queries (tenant, subscription, payments, branches).
 * This interface keeps application services testable without a live database.
 */

import type {
  OutletCoverageSummary,
  PromoValidationResult,
  PromoCodeRecord,
  BranchCoverageInfo,
  TenantInfo,
  SubscriptionInfo,
  SaaSPaymentRecord,
  CreatePaymentData,
  TenantLimits,
  SnapTransactionParams,
  SnapTransactionResult,
  MidtransNotification,
  SaaSPaymentStatus,
  TenantPlan,
} from "./types";

export interface BillingRepository {
  // ── Coverage & limits (from lib/billing.ts) ──
  getOutletCoverageStatus(tenantId: string): Promise<OutletCoverageSummary>;
  getTenantLimits(tenantId: string): Promise<TenantLimits>;
  isTenantPaid(tenantId: string): Promise<boolean>;

  // ── Promo validation & redemption (from lib/billing.ts) ──
  validatePromoCode(
    code: string,
    tenantId: string,
    planTier?: "GROWTH" | "PRO",
  ): Promise<PromoValidationResult>;
  redeemPromoCode(promoCodeId: string, tenantId: string): Promise<void>;
  getTenantPlan(tenantId: string): Promise<TenantPlan>;
  getTierUnitPrice(tier: "GROWTH" | "PRO"): Promise<number>;

  // ── Payment lifecycle (from lib/billing.ts + Prisma) ──
  createPayment(data: CreatePaymentData): Promise<SaaSPaymentRecord>;
  findPaymentByMidtransOrderId(
    orderId: string,
  ): Promise<SaaSPaymentRecord | null>;
  updatePaymentSnapToken(
    paymentId: string,
    snapToken: string,
  ): Promise<void>;
  updatePaymentStatus(
    paymentId: string,
    status: SaaSPaymentStatus,
  ): Promise<void>;
  markPaymentPaidAndRecompute(
    tenantId: string,
    paymentId: string,
  ): Promise<void>;

  // ── Tenant & subscription queries (Prisma) ──
  getTenantInfo(tenantId: string): Promise<TenantInfo | null>;
  getSubscription(tenantId: string): Promise<SubscriptionInfo | null>;
  getRecentPayments(
    tenantId: string,
    limit: number,
  ): Promise<SaaSPaymentRecord[]>;

  // ── Branch queries (Prisma) ──
  findBranchesByIds(
    ids: string[],
    tenantId: string,
  ): Promise<BranchCoverageInfo[]>;
  countPaidBranches(tenantId: string): Promise<number>;
}

/**
 * Port for the Midtrans payment gateway.
 *
 * The infrastructure implementation wraps `lib/midtrans.ts`. Injecting this
 * port lets application services be tested with a fake gateway.
 */
export interface MidtransPort {
  readonly isDevMode: boolean;
  createSnapTransaction(
    params: SnapTransactionParams,
  ): Promise<SnapTransactionResult | null>;
  parseNotification(body: unknown): MidtransNotification;
  verifySignature(notification: MidtransNotification): boolean;
  isSuccessfulStatus(status: string): boolean;
  isFailedStatus(status: string): boolean;
}

/**
 * Re-export the pure `calculateBill` function signature so consumers can
 * import it from the port module without depending on lib/billing.ts directly.
 */
export { calculateBill } from "./types";
