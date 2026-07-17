import type { BillingRepository, MidtransPort } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { CheckoutInput, CheckoutResult } from "./dto";
import { calculateBill, type PromoCodeRecord } from "../domain/types";
import { ValidationError, NotFoundError, logger } from "@/modules/shared";

export class CreateCheckoutService {
  constructor(
    private repo: BillingRepository,
    private midtrans: MidtransPort,
  ) {}

  async execute(input: CheckoutInput, ctx: RequestContext): Promise<CheckoutResult> {
    const tenantId = ctx.tenantId;
    const months = Math.max(1, Math.min(12, input.months || 1));
    const branchIds: string[] = Array.isArray(input.branchIds) ? input.branchIds : [];

    if (branchIds.length === 0) {
      throw new ValidationError(
        "Pilih minimal satu outlet untuk diperpanjang.",
      );
    }

    // Downgrade guard: a Pro tenant can only upgrade/extend — never downgrade.
    // Resolve the effective tier from their current plan, ignoring a Growth
    // request if they're already Pro.
    const currentPlan = await this.repo.getTenantPlan(tenantId);
    const requestedTier: "GROWTH" | "PRO" = input.planTier === "PRO" ? "PRO" : "GROWTH";
    const effectiveTier: "GROWTH" | "PRO" =
      currentPlan === "PRO" ? "PRO" : requestedTier;
    // Plan-driven pricing: read the configured per-outlet price for this tier
    // (editable on the super-admin Plans page); falls back to constants.
    const unitPrice = await this.repo.getTierUnitPrice(effectiveTier);

    // ── Validate promo (if provided) ──
    let promoCodeId: string | undefined;
    let promoCodeRow: PromoCodeRecord | undefined;

    if (input.promoCode) {
      const promoResult = await this.repo.validatePromoCode(
        input.promoCode,
        tenantId,
        effectiveTier,
      );
      if (!promoResult.valid || !promoResult.promoCode) {
        throw new ValidationError(promoResult.error ?? "Kode promo tidak ditemukan.");
      }
      promoCodeId = promoResult.promoCode.id;
      promoCodeRow = promoResult.promoCode as unknown as PromoCodeRecord;
    }

    // ── Validate branches belong to tenant ──
    const branches = await this.repo.findBranchesByIds(branchIds, tenantId);

    if (branches.length !== branchIds.length) {
      throw new ValidationError("Beberapa outlet tidak ditemukan.");
    }

    const outletCount = branches.length;
    const calc = calculateBill(outletCount, months, promoCodeRow as any, unitPrice);
    const total = calc.total;
    const monthsToExtend = months + calc.freeMonths;

    // ── Generate Midtrans order ID ──
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    const midtransOrderId = `SUB-${dateStr}-${random}`;

    // ── Create SaaSPayment record ──
    const payment = await this.repo.createPayment({
      tenantId,
      amount: total,
      outletCount,
      unitPrice,
      monthsPurchased: monthsToExtend,
      promoCodeId: promoCodeId ?? null,
      midtransOrderId,
      status: "PENDING",
      kind: "RENEWAL",
      branchIds,
    });

    // ── Case 1: Free (promo makes total 0) → auto-complete ──
    if (total <= 0) {
      await this.tryRedeemPromo(promoCodeId, tenantId);
      await this.repo.markPaymentPaidAndRecompute(tenantId, payment.id);
      return {
        status: "PAID",
        snapToken: null,
        message: `Langganan berhasil diperpanjang ${monthsToExtend} bulan (${outletCount} outlet).`,
      };
    }

    // ── Case 2: Dev mode (no Midtrans keys) → auto-complete ──
    if (this.midtrans.isDevMode) {
      await this.tryRedeemPromo(promoCodeId, tenantId);
      await this.repo.markPaymentPaidAndRecompute(tenantId, payment.id);
      return {
        status: "PAID",
        snapToken: null,
        devMode: true,
        message: `[DEV MODE] Pembayaran berhasil. Langganan diperpanjang ${monthsToExtend} bulan (${outletCount} outlet).`,
      };
    }

    // ── Case 3: Real Midtrans → create Snap transaction ──
    const tenant = await this.repo.getTenantInfo(tenantId);
    if (!tenant) {
      throw new NotFoundError("Tenant", tenantId);
    }

    const snapResult = await this.midtrans.createSnapTransaction({
      orderId: midtransOrderId,
      amount: total,
      tenantName: tenant.name,
      ownerEmail: tenant.ownerEmail,
      months: months + calc.freeMonths,
      outletCount,
    });

    if (!snapResult) {
      // Fallback: auto-complete if Midtrans call failed
      await this.tryRedeemPromo(promoCodeId, tenantId);
      await this.repo.markPaymentPaidAndRecompute(tenantId, payment.id);
      return {
        status: "PAID",
        snapToken: null,
        devMode: true,
        message: "Midtrans unavailable — payment auto-completed.",
      };
    }

    await this.repo.updatePaymentSnapToken(payment.id, snapResult.snapToken);

    return {
      status: "PENDING",
      snapToken: snapResult.snapToken,
      redirectUrl: snapResult.redirectUrl,
      message: "Pembayaran telah dibuat. Selesaikan pembayaran melalui Midtrans.",
    };
  }

  /**
   * Attempt to redeem a promo code, ignoring duplicate-redemption errors.
   * The underlying `redeemPromoCode` is idempotent — a second redemption
   * is a no-op via the unique constraint, and the error is expected when
   * a webhook fires twice or a checkout is retried.
   */
  private async tryRedeemPromo(
    promoCodeId: string | undefined,
    tenantId: string,
  ): Promise<void> {
    if (!promoCodeId) return;
    try {
      await this.repo.redeemPromoCode(promoCodeId, tenantId);
    } catch (err) {
      logger.warn(
        { promoCodeId, tenantId, cause: (err as Error).message },
        "Promo redemption skipped (likely already redeemed)",
      );
    }
  }
}
