/**
 * Data Transfer Objects for the billing API.
 *
 * Every ISO date is a string, every Decimal is a number — the repository layer
 * converts before returning. This keeps the API boundary clean and JSON-safe.
 */

// ── GET /billing/status response ──

export interface BillingStatusOutletDTO {
  id: string;
  name: string;
  coverageEnd: string | null;
  isFreeTier: boolean;
  status: string;
  expiresInDays: number | null;
}

export interface BillingStatusSubscriptionDTO {
  status: string;
  planName: string;
  currentPeriodEnd: string | null;
}

export interface BillingStatusPricingDTO {
  unitPrice: number;
  originalUnitPrice: number;
}

export interface BillingStatusLimitsDTO {
  maxOutlets: number;
  maxUsers: number;
  maxOrders: number;
  isPaid: boolean;
  planName: string;
}

export interface BillingStatusPaymentDTO {
  id: string;
  amount: number;
  outletCount: number;
  monthsPurchased: number;
  status: string;
  kind: string;
  branchIds: string[];
  paidAt: string | null;
  midtransOrderId: string | null;
  createdAt: string;
}

export interface BillingStatusDTO {
  tenant: {
    name: string;
    slug: string;
    ownerEmail: string;
    activeModules: string[];
  };
  subscription: BillingStatusSubscriptionDTO | null;
  outlets: BillingStatusOutletDTO[];
  activeCount: number;
  lockedCount: number;
  expiringSoon: BillingStatusOutletDTO[];
  trialEndsAt: string | null;
  pricing: BillingStatusPricingDTO;
  limits: BillingStatusLimitsDTO;
  payments: BillingStatusPaymentDTO[];
}

// ── POST /billing/checkout ──

export interface CheckoutInput {
  months: number;
  branchIds: string[];
  promoCode?: string;
  /** ponytail: optional tier upgrade. Default GROWTH (49K). PRO adds website (79K). */
  planTier?: "GROWTH" | "PRO";
}

export interface CheckoutResult {
  status: "PAID" | "PENDING";
  snapToken: string | null;
  redirectUrl?: string;
  devMode?: boolean;
  message: string;
}

// ── POST /billing/promo/validate ──

export interface ValidatePromoInput {
  code: string;
  branchIds?: string[];
  months?: number;
  planTier?: "GROWTH" | "PRO";
}

export interface ValidatePromoResult {
  valid: boolean;
  error?: string;
  promoCode?: {
    code: string;
    type: string;
    description: string | null;
  };
  calculation?: {
    unitPrice: number;
    originalUnitPrice: number;
    outletCount: number;
    months: number;
    grossTotal: number;
    discount: number;
    total: number;
    freeMonths: number;
  };
}

// ── POST /billing/webhook ──

export interface WebhookResult {
  ok: true;
  ignored?: "unknown_order" | "already_paid" | "invalid_signature" | "already_failed";
  status?: "PAID" | "FAILED" | "PENDING";
}
