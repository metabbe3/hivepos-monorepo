import type { BillingRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { BillingStatusDTO } from "./dto";
import {
  PRICE_PER_OUTLET,
  ORIGINAL_PRICE_PER_OUTLET,
} from "../domain/types";
import { NotFoundError, toIso, toIsoRequired } from "@/modules/shared";

export class GetBillingStatusService {
  constructor(private repo: BillingRepository) {}

  async execute(ctx: RequestContext): Promise<BillingStatusDTO> {
    const [
      tenant,
      subscription,
      payments,
      limits,
      coverage,
      isPaid,
    ] = await Promise.all([
      this.repo.getTenantInfo(ctx.tenantId),
      this.repo.getSubscription(ctx.tenantId),
      this.repo.getRecentPayments(ctx.tenantId, 20),
      this.repo.getTenantLimits(ctx.tenantId),
      this.repo.getOutletCoverageStatus(ctx.tenantId),
      this.repo.isTenantPaid(ctx.tenantId),
    ]);

    if (!tenant) {
      throw new NotFoundError("Tenant", ctx.tenantId);
    }

    return {
      tenant: {
        name: tenant.name,
        slug: tenant.slug,
        ownerEmail: tenant.ownerEmail,
        activeModules: tenant.activeModules,
      },
      subscription: subscription
        ? {
            status: subscription.status,
            planName: subscription.planName,
            currentPeriodEnd: toIso(coverage.latestCoverageEnd ?? subscription.currentPeriodEnd),
          }
        : null,
      outlets: coverage.outlets.map((o) => ({
        id: o.id,
        name: o.name,
        coverageEnd: toIso(o.coverageEnd),
        isFreeTier: o.isFreeTier,
        status: o.status,
        expiresInDays: o.expiresInDays,
      })),
      activeCount: coverage.activeCount,
      lockedCount: coverage.lockedCount,
      expiringSoon: coverage.expiringSoon.map((o) => ({
        id: o.id,
        name: o.name,
        coverageEnd: toIsoRequired(o.coverageEnd!),
        isFreeTier: o.isFreeTier,
        status: o.status,
        expiresInDays: o.expiresInDays,
      })),
      trialEndsAt: toIso(tenant.trialEndsAt),
      pricing: {
        unitPrice: PRICE_PER_OUTLET,
        originalUnitPrice: ORIGINAL_PRICE_PER_OUTLET,
      },
      limits: {
        maxOutlets: limits.maxOutlets,
        maxUsers: limits.maxUsers,
        maxOrders: limits.maxOrders,
        isPaid,
        planName: limits.planName,
      },
      payments: payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        outletCount: p.outletCount,
        monthsPurchased: p.monthsPurchased,
        status: p.status,
        kind: p.kind,
        branchIds: p.branchIds,
        paidAt: toIso(p.paidAt),
        midtransOrderId: p.midtransOrderId,
        createdAt: toIsoRequired(p.createdAt),
      })),
    };
  }
}
