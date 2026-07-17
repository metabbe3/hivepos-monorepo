import { prisma } from "@/lib/prisma";
import { makeTtlCache } from "@/lib/cache";
import type { PromoCode } from "@/app/generated/prisma/client";

// ── Pricing constants ──
export const PRICE_PER_OUTLET = 49000;
export const ORIGINAL_PRICE_PER_OUTLET = 79000;
// ponytail: Pro tier = Growth + public laundry website. Same per-outlet billing flow,
// different unit price. add PLAN_FEATURES.website to gate the website feature.
export const PRO_PRICE_PER_OUTLET = 79000;

/// Free-trial length (days) for new signups — single source of truth. Honors the
/// landing page "Coba Growth/Pro 14 Hari Gratis" claim. Adopted in register +
/// approve + seed so the trial length can't drift between them.
export const TRIAL_DAYS = 14;

const UNLIMITED = 999999;

export const PLAN_FEATURES = {
  FREE:   { publicWebsite: false, maxOutlets: 1,         maxUsers: 2,         maxOrders: 100 },
  GROWTH: { publicWebsite: false, maxOutlets: UNLIMITED, maxUsers: UNLIMITED, maxOrders: UNLIMITED },
  PRO:    { publicWebsite: true,  maxOutlets: UNLIMITED, maxUsers: UNLIMITED, maxOrders: UNLIMITED },
} as const;

export type TenantPlan = "FREE" | "GROWTH" | "PRO";

/**
 * Decide a tenant's plan during their free trial. Pure + unit-tested (no prisma).
 * Returns the trial tier while `trialEndsAt` is in the future, FREE once it
 * passes — the lazy auto-revert. getTenantPlan recomputes this every call, so a
 * trial expires itself with no cron. Unknown trialTier defaults to GROWTH (the
 * primary landing-page CTA).
 */
export function resolveTrialPlan(input: {
  trialEndsAt: Date | null;
  trialTier: string | null;
  now: Date;
}): TenantPlan {
  const { trialEndsAt, trialTier, now } = input;
  if (!trialEndsAt || trialEndsAt.getTime() <= now.getTime()) return "FREE";
  return trialTier === "PRO" ? "PRO" : "GROWTH";
}

/**
 * ponytail: plan discrimination from payment history. A tenant is Pro if any
 * PAID SaaSPayment has unitPrice >= PRO_PRICE_PER_OUTLET. Growth = any other
 * paid history. Unpaid tenants fall back to their free-trial tier (or FREE once
 * the trial window closes). Survives the existing per-outlet coverage model.
 */
export async function getTenantPlan(tenantId: string): Promise<TenantPlan> {
  const proPayment = await prisma.saaSPayment.findFirst({
    where: {
      tenantId,
      status: "PAID",
      unitPrice: { gte: PRO_PRICE_PER_OUTLET },
    },
    select: { id: true },
  });
  if (proPayment) return "PRO";

  const paid = await isTenantPaid(tenantId);
  if (paid) return "GROWTH";

  // Unpaid: honor the free-trial window. Lazy revert — once trialEndsAt passes,
  // resolveTrialPlan returns FREE on the next call, no expiry job needed.
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { trialEndsAt: true, trialTier: true },
  });
  return resolveTrialPlan({
    trialEndsAt: tenant?.trialEndsAt ?? null,
    trialTier: tenant?.trialTier ?? null,
    now: new Date(),
  });
}

/**
 * Per-outlet unit price for a tier, read from the active Plan record so plan
 * pricing is configurable from the super-admin Plans page. Falls back to the
 * hardcoded constants if no active plan exists for the tier (never breaks).
 */
// ponytail: plan prices change rarely (super-admin edit) → 5min TTL cache.
const tierPriceCache = makeTtlCache<"GROWTH" | "PRO", number>(5 * 60_000);
export async function getTierUnitPrice(tier: "GROWTH" | "PRO"): Promise<number> {
  const cached = tierPriceCache.get(tier);
  if (cached !== undefined) return cached;
  const plan = await prisma.plan.findFirst({
    where: { tier, isActive: true },
    select: { priceMonthly: true },
  });
  const price = plan ? Number(plan.priceMonthly) : tier === "PRO" ? PRO_PRICE_PER_OUTLET : PRICE_PER_OUTLET;
  tierPriceCache.set(tier, price);
  return price;
}

// Free tier limits (when tenant has no paid outlets)
export const FREE_TIER = {
  maxOutlets: 1,
  maxUsers: 2,
  maxOrders: 100, // per month
} as const;

const GROWTH_PLAN_NAME = "Growth";
const FREE_PLAN_NAME = "Free";
const PRO_PLAN_NAME = "Pro";

/** Days before expiry to flag as "expiring soon" */
const EXPIRING_SOON_DAYS = 30;

// ── Date helpers ──

/** Add N months to a date (immutable). */
export function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

// ── Outlet coverage status ──

export type OutletStatus = "FREE" | "ACTIVE" | "LOCKED" | "EXPIRING";

export interface OutletCoverage {
  id: string;
  name: string;
  coverageEnd: Date | null;
  isFreeTier: boolean;
  status: OutletStatus;
  expiresInDays: number | null;
}

export interface OutletCoverageSummary {
  outlets: OutletCoverage[];
  activeCount: number;
  lockedCount: number;
  expiringSoon: OutletCoverage[];
  latestCoverageEnd: Date | null;
}

/**
 * Get all branches with their coverage status for a tenant.
 *
 * Status logic:
 *   FREE       → isFreeTier = true (always active, limited features)
 *   ACTIVE     → coverageEnd > now + EXPIRING_SOON_DAYS
 *   EXPIRING   → coverageEnd > now AND coverageEnd <= now + EXPIRING_SOON_DAYS
 *   LOCKED     → coverageEnd <= now (or null and not free tier)
 */
export async function getOutletCoverageStatus(tenantId: string): Promise<OutletCoverageSummary> {
  const now = new Date();
  const expiringThreshold = addMonths(now, 0);
  expiringThreshold.setDate(expiringThreshold.getDate() + EXPIRING_SOON_DAYS);

  const branches = await prisma.branch.findMany({
    where: { tenantId },
    orderBy: [{ isFreeTier: "desc" }, { createdAt: "asc" }],
    select: { id: true, name: true, coverageEnd: true, isFreeTier: true },
  });

  let activeCount = 0;
  let lockedCount = 0;
  let latestCoverageEnd: Date | null = null;
  const expiringSoon: OutletCoverage[] = [];

  const outlets: OutletCoverage[] = branches.map((b) => {
    let status: OutletStatus;
    let expiresInDays: number | null = null;

    if (b.isFreeTier) {
      status = "FREE";
    } else if (b.coverageEnd && b.coverageEnd.getTime() > now.getTime()) {
      const DAY_MS = 1000 * 60 * 60 * 24;
      expiresInDays = Math.ceil((b.coverageEnd.getTime() - now.getTime()) / DAY_MS);

      if (b.coverageEnd.getTime() <= expiringThreshold.getTime()) {
        status = "EXPIRING";
        expiringSoon.push({
          id: b.id,
          name: b.name,
          coverageEnd: b.coverageEnd,
          isFreeTier: b.isFreeTier,
          status,
          expiresInDays,
        });
      } else {
        status = "ACTIVE";
      }
      activeCount++;

      if (!latestCoverageEnd || b.coverageEnd.getTime() > latestCoverageEnd.getTime()) {
        latestCoverageEnd = b.coverageEnd;
      }
    } else {
      status = "LOCKED";
      lockedCount++;
    }

    return {
      id: b.id,
      name: b.name,
      coverageEnd: b.coverageEnd,
      isFreeTier: b.isFreeTier,
      status,
      expiresInDays,
    };
  });

  // Sort expiring soon by closest expiry first
  expiringSoon.sort((a, b) => {
    const aTime = a.coverageEnd?.getTime() ?? 0;
    const bTime = b.coverageEnd?.getTime() ?? 0;
    return aTime - bTime;
  });

  return { outlets, activeCount, lockedCount, expiringSoon, latestCoverageEnd };
}

// ── Tenant paid status ──

/** A tenant is "paid" if any non-free branch has active coverage (coverageEnd > now). */
export async function isTenantPaid(tenantId: string): Promise<boolean> {
  const count = await prisma.branch.count({
    where: {
      tenantId,
      isFreeTier: false,
      coverageEnd: { gt: new Date() },
    },
  });
  return count > 0;
}

/** Get the effective limits for a tenant. Paid = unlimited, free tier = limited. */
export async function getTenantLimits(
  tenantId: string,
): Promise<{
  maxOutlets: number;
  maxUsers: number;
  maxOrders: number;
  isPaid: boolean;
  planName: string;
}> {
  const plan = await getTenantPlan(tenantId);
  if (plan === "FREE") {
    // ponytail: read configurable limits from DB Plan row (editable via super-admin).
    // Falls back to hardcoded FREE_TIER if the row is missing (unseeded DB / pre-migration).
    const dbPlan = await prisma.plan.findUnique({
      where: { name: FREE_PLAN_NAME },
      select: { maxOutlets: true, maxUsers: true, maxOrders: true },
    });
    if (dbPlan) {
      return {
        maxOutlets: dbPlan.maxOutlets,
        maxUsers: dbPlan.maxUsers,
        maxOrders: dbPlan.maxOrders,
        isPaid: false,
        planName: FREE_PLAN_NAME,
      };
    }
    return { ...FREE_TIER, isPaid: false, planName: FREE_PLAN_NAME };
  }
  return {
    maxOutlets: UNLIMITED,
    maxUsers: UNLIMITED,
    maxOrders: UNLIMITED,
    isPaid: true,
    planName: plan === "PRO" ? PRO_PLAN_NAME : GROWTH_PLAN_NAME,
  };
}

// ── Limit checks (for enforcement on create operations) ──

export type LimitType = "outlets" | "users" | "orders";

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  max: number;
  isPaid: boolean;
  reason?: string;
  blockReason?: "FREE_TIER";
}

export async function checkLimit(tenantId: string, type: LimitType): Promise<LimitCheckResult> {
  // Outlets are always allowed — unlimited creation (activation requires payment)
  if (type === "outlets") {
    const current = await prisma.branch.count({ where: { tenantId, isActive: true } });
    return { allowed: true, current, max: UNLIMITED, isPaid: false };
  }

  const limits = await getTenantLimits(tenantId);
  const max = type === "users" ? limits.maxUsers : limits.maxOrders;

  let current: number;
  if (type === "users") {
    current = await prisma.user.count({ where: { tenantId, isActive: true } });
  } else {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    current = await prisma.order.count({
      where: { branch: { tenantId }, createdAt: { gte: monthStart } },
    });
  }

  const allowed = current < max;
  const result: LimitCheckResult = {
    allowed,
    current,
    max,
    isPaid: limits.isPaid,
  };

  if (!allowed) {
    result.blockReason = "FREE_TIER";
    result.reason = `Batas ${type === "users" ? "staff" : "order bulanan"} gratis tercapai (${current}/${max}). Upgrade untuk akses tanpa batas.`;
  }

  return result;
}

// ── Promo code validation ──

export interface PromoValidationResult {
  valid: boolean;
  promoCode?: PromoCode;
  error?: string;
}

export async function validatePromoCode(
  code: string,
  tenantId: string,
  planTier?: "GROWTH" | "PRO",
): Promise<PromoValidationResult> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { valid: false, error: "Kode promo tidak boleh kosong." };

  const promo = await prisma.promoCode.findUnique({
    where: { code: normalized },
  });

  if (!promo) return { valid: false, error: "Kode promo tidak ditemukan." };
  if (!promo.isActive) return { valid: false, error: "Kode promo sudah tidak aktif." };

  const now = new Date();
  if (promo.validFrom && now < promo.validFrom) return { valid: false, error: "Kode promo belum berlaku." };
  if (promo.validUntil && now > promo.validUntil) return { valid: false, error: "Kode promo sudah kedaluwarsa." };

  if (promo.maxRedemptions !== null && promo.redemptionCount >= promo.maxRedemptions) {
    return { valid: false, error: "Kuota promo sudah habis." };
  }

  // One redemption per tenant per code
  const alreadyRedeemed = await prisma.promoRedemption.findUnique({
    where: { promoCodeId_tenantId: { promoCodeId: promo.id, tenantId } },
  });
  if (alreadyRedeemed) return { valid: false, error: "Anda sudah menggunakan kode promo ini." };

  // Plan restriction (null = applies to any tier). Callers pass the effective
  // planTier so a Pro-only promo can't be applied to a Growth checkout.
  if (promo.applicablePlan && planTier && promo.applicablePlan !== planTier) {
    const planLabel = promo.applicablePlan === "PRO" ? "Pro" : "Growth";
    return { valid: false, error: `Promo ini hanya untuk paket ${planLabel}.` };
  }

  return { valid: true, promoCode: promo };
}

// ── Bill calculation ──

export interface BillCalculation {
  outletCount: number;
  months: number;
  originalUnitPrice: number;
  unitPrice: number;
  grossTotal: number; // unitPrice × outlets × months
  discount: number;
  total: number; // grossTotal - discount
  freeMonths: number;
  promoCode?: PromoCode;
}

export function calculateBill(
  outletCount: number,
  months: number,
  promoCode?: PromoCode,
  unitPrice: number = PRICE_PER_OUTLET,
): BillCalculation {
  const grossTotal = unitPrice * outletCount * months;
  let discount = 0;
  let freeMonths = 0;

  if (promoCode) {
    const promoValue = Number(promoCode.value);
    if (promoCode.type === "FREE_MONTH") {
      freeMonths = promoValue;
      const monthsToCharge = Math.max(0, months - freeMonths);
      discount = grossTotal - unitPrice * outletCount * monthsToCharge;
    } else if (promoCode.type === "DISCOUNT_PERCENT") {
      discount = Math.round((grossTotal * promoValue) / 100);
    } else if (promoCode.type === "DISCOUNT_FIXED") {
      discount = Math.min(promoValue, grossTotal);
    }
  }

  const total = Math.max(0, grossTotal - discount);

  return {
    outletCount,
    months,
    originalUnitPrice: ORIGINAL_PRICE_PER_OUTLET,
    unitPrice,
    grossTotal,
    discount,
    total,
    freeMonths,
    promoCode,
  };
}

// ── Per-outlet coverage extension ──

/**
 * Extend coverage for specific outlets after a payment is confirmed.
 *
 * For each branch:
 *   - If coverageEnd is null or in the past → new coverageEnd = addMonths(now, months)
 *   - If coverageEnd is in the future → new coverageEnd = addMonths(coverageEnd, months)
 *
 * (Independent per-outlet renewal — like domain renewals.)
 */
export async function extendOutletCoverage(
  tx: Parameters<Parameters<typeof prisma["$transaction"]>[0]>[0],
  tenantId: string,
  branchIds: string[],
  months: number,
): Promise<void> {
  const now = new Date();

  for (const branchId of branchIds) {
    const branch = await tx.branch.findUniqueOrThrow({
      where: { id: branchId },
      select: { coverageEnd: true, isFreeTier: true },
    });

    // Free tier outlets get upgraded to paid: set isFreeTier=false, coverage from now
    if (branch.isFreeTier) {
      await tx.branch.update({
        where: { id: branchId },
        data: {
          isFreeTier: false,
          coverageEnd: addMonths(now, months),
        },
      });
      continue;
    }

    const base =
      branch.coverageEnd && branch.coverageEnd.getTime() > now.getTime()
        ? branch.coverageEnd
        : now;

    const newCoverageEnd = addMonths(base, months);

    await tx.branch.update({
      where: { id: branchId },
      data: { coverageEnd: newCoverageEnd },
    });
  }
}

// ── Subscription cache management ──

// ponytail: the Growth plan id is stable once seeded → 5min TTL cache.
const growthPlanIdCache = makeTtlCache<"growth", string>(5 * 60_000);
/** Ensure a "Growth" plan exists, returning its id. */
async function getGrowthPlanId(): Promise<string> {
  const cached = growthPlanIdCache.get("growth");
  if (cached) return cached;
  let plan = await prisma.plan.findUnique({ where: { name: GROWTH_PLAN_NAME } });
  if (!plan) {
    plan = await prisma.plan.create({
      data: {
        name: GROWTH_PLAN_NAME,
        description: "Per-outlet pricing — all modules included",
        maxOutlets: UNLIMITED,
        maxUsers: UNLIMITED,
        maxOrders: UNLIMITED,
        priceMonthly: PRICE_PER_OUTLET,
        modules: ["laundry", "fnb", "salon", "cleaning"],
      },
    });
  }
  growthPlanIdCache.set("growth", plan.id);
  return plan.id;
}

/** Clear the plan caches. Call after a super-admin plan create/edit/deactivate/delete. */
export function invalidatePlanCache(): void {
  tierPriceCache.clear();
  growthPlanIdCache.clear();
}

/**
 * Mark a PENDING SaaSPayment as PAID, extend branch coverage, and update
 * the subscription cache.
 *
 * The payment must have `branchIds` set — these are the outlets to extend.
 */
export async function markPaymentPaidAndRecompute(
  tenantId: string,
  paymentId: string,
): Promise<void> {
  const planId = await getGrowthPlanId();

  await prisma.$transaction(async (tx) => {
    const payment = await tx.saaSPayment.findUniqueOrThrow({
      where: { id: paymentId },
    });

    if (payment.status !== "PENDING") {
      throw new Error(
        `Payment ${paymentId} already processed (status=${payment.status})`,
      );
    }

    // Mark payment PAID
    await tx.saaSPayment.update({
      where: { id: paymentId },
      data: { status: "PAID", paidAt: new Date() },
    });

    // Extend coverage for each branch in the payment
    if (payment.branchIds.length > 0) {
      await extendOutletCoverage(tx, tenantId, payment.branchIds, payment.monthsPurchased);
    }

    // Recompute subscription cache from branch coverage
    const branches = await tx.branch.findMany({
      where: { tenantId, isFreeTier: false, coverageEnd: { not: null } },
      select: { coverageEnd: true },
    });

    const now = new Date();
    let latestCoverageEnd: Date | null = null;
    let hasActiveCoverage = false;

    for (const b of branches) {
      if (b.coverageEnd) {
        if (!latestCoverageEnd || b.coverageEnd.getTime() > latestCoverageEnd.getTime()) {
          latestCoverageEnd = b.coverageEnd;
        }
        if (b.coverageEnd.getTime() > now.getTime()) {
          hasActiveCoverage = true;
        }
      }
    }

    // Upsert subscription cache
    const existing = await tx.subscription.findUnique({ where: { tenantId } });

    if (existing) {
      await tx.subscription.update({
        where: { tenantId },
        data: {
          planId,
          status: hasActiveCoverage ? "ACTIVE" : "EXPIRED",
          currentPeriodEnd: latestCoverageEnd,
        },
      });
    } else if (hasActiveCoverage) {
      await tx.subscription.create({
        data: {
          tenantId,
          planId,
          status: "ACTIVE",
          currentPeriodEnd: latestCoverageEnd,
          currentPeriodStart: now,
        },
      });
    }
  });
}

/** Redeem a promo code for a tenant (creates PromoRedemption + increments count). */
export async function redeemPromoCode(promoCodeId: string, tenantId: string): Promise<void> {
  await prisma.$transaction([
    prisma.promoRedemption.create({ data: { promoCodeId, tenantId } }),
    prisma.promoCode.update({
      where: { id: promoCodeId },
      data: { redemptionCount: { increment: 1 } },
    }),
  ]);
}
