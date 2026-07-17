import type { BillingRepository, MidtransPort } from "../domain/repository.port";
import type { WebhookResult } from "./dto";
import { ValidationError, logger } from "@/modules/shared";
import { maybeRewardReferral } from "@/lib/referrals";

export class HandleWebhookService {
  constructor(
    private repo: BillingRepository,
    private midtrans: MidtransPort,
  ) {}

  async execute(body: unknown): Promise<WebhookResult> {
    const notification = this.midtrans.parseNotification(body);
    const { orderId, transactionStatus, fraudStatus } = notification;

    if (!orderId) {
      throw new ValidationError("Missing order_id");
    }

    // ── Signature verification ──
    // ponytail: shared merchant → untrusted actors could fire fake webhooks.
    // Verify before any DB write. Always ack with 200 so Midtrans stops retrying.
    if (!this.midtrans.verifySignature(notification)) {
      logger.warn(
        { orderId },
        "Midtrans webhook signature mismatch — ignoring",
      );
      return { ok: true, ignored: "invalid_signature" };
    }

    // Find the corresponding SaaSPayment record
    const payment = await this.repo.findPaymentByMidtransOrderId(orderId);

    if (!payment) {
      // Unknown order — return 200 so Midtrans stops retrying
      return { ok: true, ignored: "unknown_order" };
    }

    // Idempotent: already paid — nothing to do
    if (payment.status === "PAID") {
      return { ok: true, ignored: "already_paid" };
    }

    // ── Classify notification status ──
    const isOk =
      this.midtrans.isSuccessfulStatus(transactionStatus) &&
      (fraudStatus === undefined || fraudStatus === "accept");

    // Already failed and this isn't a success → no-op.
    // Allow FAILED → PAID for legitimate Midtrans recovery (deny → settlement).
    if (payment.status === "FAILED" && !isOk) {
      return { ok: true, ignored: "already_failed" };
    }

    if (isOk) {
      // Redeem promo if attached (ignore duplicate-redemption errors)
      if (payment.promoCodeId) {
        try {
          await this.repo.redeemPromoCode(payment.promoCodeId, payment.tenantId);
        } catch (err) {
          logger.warn(
            {
              promoCodeId: payment.promoCodeId,
              tenantId: payment.tenantId,
              cause: (err as Error).message,
            },
            "Webhook promo redemption skipped (likely already redeemed)",
          );
        }
      }

      // Mark PAID + extend coverage + recompute subscription cache
      await this.repo.markPaymentPaidAndRecompute(
        payment.tenantId,
        payment.id,
      );

      // Referral reward (best-effort): if this is the referred tenant's first
      // paid payment, grant a free outlet-month to both sides. Never throws —
      // the payment is already confirmed; the reward is a bonus.
      await maybeRewardReferral(payment.tenantId);

      return { ok: true, status: "PAID" };
    }

    // ── Failure path ──
    if (this.midtrans.isFailedStatus(transactionStatus)) {
      await this.repo.updatePaymentStatus(payment.id, "FAILED");
      return { ok: true, status: "FAILED" };
    }

    // Pending / other — leave as PENDING, ack the notification
    return { ok: true, status: "PENDING" };
  }
}
