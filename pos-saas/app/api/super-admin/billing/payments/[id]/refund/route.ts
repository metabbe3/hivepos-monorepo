import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
  NotFoundError,
  ConflictError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

// POST → mark PAID SaaSPayment as REFUNDED.
// SUPER_ADMIN only. Reason ≥10 chars required. Financial-only: no coverage revocation.
export const POST = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10) {
      throw new ValidationError("Alasan terlalu pendek — minimal 10 huruf.");
    }

    const payment = await prisma.saaSPayment.findUnique({
      where: { id },
      select: { id: true, status: true, tenantId: true, amount: true },
    });
    if (!payment) throw new NotFoundError("Payment", id);
    if (payment.status !== "PAID") {
      throw new ConflictError(
        `Only PAID payments can be refunded (current: ${payment.status})`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.saaSPayment.update({
        where: { id },
        data: { status: "REFUNDED" },
      });
      await auditLog(tx, {
        actor,
        action: "billing.refund",
        target: { type: "SaaSPayment", id, tenantId: payment.tenantId },
        reason,
        diff: { status: { from: "PAID", to: "REFUNDED" }, amount: Number(payment.amount) },
        req,
      });
    });

    return apiSuccess({ payment: { id, status: "REFUNDED" } });
  },
);
