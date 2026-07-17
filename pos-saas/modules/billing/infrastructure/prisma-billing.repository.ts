import { prisma } from "@/lib/prisma";
import {
  getOutletCoverageStatus,
  getTenantLimits,
  isTenantPaid,
  validatePromoCode,
  redeemPromoCode,
  markPaymentPaidAndRecompute,
  getTenantPlan,
  getTierUnitPrice,
} from "@/lib/billing";
import type { BillingRepository } from "../domain/repository.port";
import type {
  OutletCoverageSummary,
  PromoValidationResult,
  CreatePaymentData,
  SaaSPaymentRecord,
  SaaSPaymentStatus,
  TenantInfo,
  SubscriptionInfo,
  BranchCoverageInfo,
  TenantLimits,
  TenantPlan,
} from "../domain/types";

function mapPayment(p: {
  id: string;
  tenantId: string;
  amount: { toNumber(): number };
  outletCount: number;
  monthsPurchased: number;
  status: string;
  kind: string;
  branchIds: string[];
  promoCodeId: string | null;
  midtransOrderId: string | null;
  midtransSnapToken: string | null;
  paidAt: Date | null;
  createdAt: Date;
}): SaaSPaymentRecord {
  return {
    id: p.id,
    tenantId: p.tenantId,
    amount: p.amount.toNumber(),
    outletCount: p.outletCount,
    monthsPurchased: p.monthsPurchased,
    status: p.status as SaaSPaymentStatus,
    kind: p.kind,
    branchIds: p.branchIds,
    promoCodeId: p.promoCodeId,
    midtransOrderId: p.midtransOrderId,
    midtransSnapToken: p.midtransSnapToken,
    paidAt: p.paidAt,
    createdAt: p.createdAt,
  };
}

export class PrismaBillingRepository implements BillingRepository {
  // ── Coverage & limits ──
  async getOutletCoverageStatus(tenantId: string): Promise<OutletCoverageSummary> {
    return getOutletCoverageStatus(tenantId);
  }

  async getTenantLimits(tenantId: string): Promise<TenantLimits> {
    return getTenantLimits(tenantId);
  }

  async isTenantPaid(tenantId: string): Promise<boolean> {
    return isTenantPaid(tenantId);
  }

  // ── Promo validation & redemption ──
  async validatePromoCode(
    code: string,
    tenantId: string,
    planTier?: "GROWTH" | "PRO",
  ): Promise<PromoValidationResult> {
    return validatePromoCode(code, tenantId, planTier);
  }

  async redeemPromoCode(promoCodeId: string, tenantId: string): Promise<void> {
    return redeemPromoCode(promoCodeId, tenantId);
  }

  async getTenantPlan(tenantId: string): Promise<TenantPlan> {
    return getTenantPlan(tenantId);
  }

  async getTierUnitPrice(tier: "GROWTH" | "PRO"): Promise<number> {
    return getTierUnitPrice(tier);
  }

  // ── Payment lifecycle ──
  async createPayment(data: CreatePaymentData): Promise<SaaSPaymentRecord> {
    const payment = await prisma.saaSPayment.create({
      data: {
        tenantId: data.tenantId,
        amount: data.amount,
        outletCount: data.outletCount,
        unitPrice: data.unitPrice,
        monthsPurchased: data.monthsPurchased,
        promoCodeId: data.promoCodeId,
        midtransOrderId: data.midtransOrderId,
        status: data.status,
        kind: data.kind,
        branchIds: data.branchIds,
      },
      select: {
        id: true,
        tenantId: true,
        amount: true,
        outletCount: true,
        monthsPurchased: true,
        status: true,
        kind: true,
        branchIds: true,
        promoCodeId: true,
        midtransOrderId: true,
        midtransSnapToken: true,
        paidAt: true,
        createdAt: true,
      },
    });
    return mapPayment(payment);
  }

  async findPaymentByMidtransOrderId(
    orderId: string,
  ): Promise<SaaSPaymentRecord | null> {
    const payment = await prisma.saaSPayment.findUnique({
      where: { midtransOrderId: orderId },
      select: {
        id: true,
        tenantId: true,
        amount: true,
        outletCount: true,
        monthsPurchased: true,
        status: true,
        kind: true,
        branchIds: true,
        promoCodeId: true,
        midtransOrderId: true,
        midtransSnapToken: true,
        paidAt: true,
        createdAt: true,
      },
    });
    return payment ? mapPayment(payment) : null;
  }

  async updatePaymentSnapToken(
    paymentId: string,
    snapToken: string,
  ): Promise<void> {
    await prisma.saaSPayment.update({
      where: { id: paymentId },
      data: { midtransSnapToken: snapToken },
    });
  }

  async updatePaymentStatus(
    paymentId: string,
    status: SaaSPaymentStatus,
  ): Promise<void> {
    await prisma.saaSPayment.update({
      where: { id: paymentId },
      data: { status },
    });
  }

  async markPaymentPaidAndRecompute(
    tenantId: string,
    paymentId: string,
  ): Promise<void> {
    return markPaymentPaidAndRecompute(tenantId, paymentId);
  }

  // ── Tenant & subscription queries ──
  async getTenantInfo(tenantId: string): Promise<TenantInfo | null> {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        name: true,
        slug: true,
        ownerEmail: true,
        trialEndsAt: true,
        activeModules: true,
      },
    });
    if (!tenant) return null;
    return {
      name: tenant.name,
      slug: tenant.slug,
      ownerEmail: tenant.ownerEmail,
      trialEndsAt: tenant.trialEndsAt,
      activeModules: tenant.activeModules,
    };
  }

  async getSubscription(tenantId: string): Promise<SubscriptionInfo | null> {
    const sub = await prisma.subscription.findUnique({
      where: { tenantId },
      include: { plan: true },
    });
    if (!sub) return null;
    return {
      status: sub.status as SubscriptionInfo["status"],
      planName: sub.plan.name,
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  async getRecentPayments(
    tenantId: string,
    limit: number,
  ): Promise<SaaSPaymentRecord[]> {
    const payments = await prisma.saaSPayment.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        tenantId: true,
        amount: true,
        outletCount: true,
        monthsPurchased: true,
        status: true,
        kind: true,
        branchIds: true,
        promoCodeId: true,
        midtransOrderId: true,
        midtransSnapToken: true,
        paidAt: true,
        createdAt: true,
      },
    });
    return payments.map(mapPayment);
  }

  // ── Branch queries ──
  async findBranchesByIds(
    ids: string[],
    tenantId: string,
  ): Promise<BranchCoverageInfo[]> {
    const branches = await prisma.branch.findMany({
      where: { id: { in: ids }, tenantId },
      select: { id: true, name: true, isFreeTier: true, coverageEnd: true },
    });
    return branches;
  }

  async countPaidBranches(tenantId: string): Promise<number> {
    return prisma.branch.count({
      where: { tenantId, isFreeTier: false },
    });
  }
}
