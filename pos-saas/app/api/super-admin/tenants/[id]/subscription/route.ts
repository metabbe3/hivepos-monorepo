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
import { getTenantPlan, type TenantPlan } from "@/lib/billing";

type Op = "extend_trial" | "cancel" | "change_plan" | "mark_paid";

// PATCH — perform a subscription override. Body: { op, ...op-specific fields, reason }
// All ops require a reason (≥10 chars) for the audit log.
export const PATCH = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));

    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10) {
      throw new ValidationError("Alasan terlalu pendek — minimal 10 huruf.");
    }

    const op = body?.op as Op | undefined;
    if (!op || !["extend_trial", "cancel", "change_plan", "mark_paid"].includes(op)) {
      throw new ValidationError("Operasi tidak valid.");
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: { subscription: { include: { plan: true } } },
    });
    if (!tenant) throw new NotFoundError("Tenant", id);

    switch (op) {
      case "extend_trial": {
        const days = Math.floor(Number(body?.days));
        if (!Number.isFinite(days) || days <= 0 || days > 365) {
          throw new ValidationError("Jumlah hari harus di antara 1 dan 365.");
        }
        if (!tenant.subscription) {
          throw new ConflictError("Tenant has no subscription record");
        }
        const base = tenant.subscription.currentPeriodEnd ?? new Date();
        const next = new Date(base);
        next.setDate(next.getDate() + days);

        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { tenantId: id },
            data: {
              status: "TRIAL",
              currentPeriodEnd: next,
            },
          });
          await tx.tenant.update({
            where: { id },
            data: {
              trialEndsAt: next,
            },
          });
          await auditLog(tx, {
            actor,
            action: "subscription.extend_trial",
            target: { type: "Subscription", id: tenant.subscription!.id, tenantId: id },
            reason,
            diff: { days, currentPeriodEnd: next.toISOString() },
            req,
          });
        });

        return apiSuccess({ op: op as string, ok: true });
      }

      case "cancel": {
        if (!tenant.subscription) {
          throw new ConflictError("Tenant has no subscription record");
        }
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { tenantId: id },
            data: { status: "CANCELED" },
          });
          await auditLog(tx, {
            actor,
            action: "subscription.cancel",
            target: { type: "Subscription", id: tenant.subscription!.id, tenantId: id },
            reason,
            diff: { status: { from: tenant.subscription!.status, to: "CANCELED" } },
            req,
          });
        });
        return apiSuccess({ op: op as string, ok: true });
      }

      case "change_plan": {
        const planId = typeof body?.planId === "string" ? body.planId : null;
        if (!planId) throw new ValidationError("Paket wajib dipilih.");
        const plan = await prisma.plan.findUnique({ where: { id: planId } });
        if (!plan || !plan.isActive) {
          throw new NotFoundError("Plan", planId);
        }
        if (!tenant.subscription) {
          throw new ConflictError("Tenant has no subscription record");
        }
        // Downgrade guard: a Pro tenant cannot be moved to a lower tier.
        const currentTier = await getTenantPlan(id);
        const targetTier: TenantPlan =
          plan.tier ?? (plan.name === "Pro" ? "PRO" : plan.name === "Growth" ? "GROWTH" : "FREE");
        if (currentTier === "PRO" && targetTier !== "PRO") {
          throw new ValidationError(
            "Tenant Pro tidak dapat diturunkan ke paket yang lebih rendah. Gunakan Extend Trial / Mark Paid saja.",
          );
        }
        const prevPlanId = tenant.subscription.planId;
        await prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { tenantId: id },
            data: { planId },
          });
          await auditLog(tx, {
            actor,
            action: "subscription.change_plan",
            target: { type: "Subscription", id: tenant.subscription!.id, tenantId: id },
            reason,
            diff: { planId: { from: prevPlanId, to: planId }, planName: plan.name },
            req,
          });
        });
        return apiSuccess({ op: op as string, ok: true });
      }

      case "mark_paid": {
        // Records a manual SaaSPayment (offline transfer, cash, etc.) without going through Midtrans.
        const amount = Number(body?.amount);
        if (!Number.isFinite(amount) || amount <= 0) {
          throw new ValidationError("Jumlah harus lebih dari 0.");
        }
        const months = Math.floor(Number(body?.months));
        if (!Number.isFinite(months) || months <= 0) {
          throw new ValidationError("Jumlah bulan minimal 1.");
        }
        const outletCount = Math.floor(Number(body?.outletCount ?? tenant.subscription?.paidOutletCount ?? 1));
        if (!Number.isFinite(outletCount) || outletCount <= 0) {
          throw new ValidationError("Jumlah outlet minimal 1.");
        }

        const now = new Date();
        const base = tenant.subscription?.currentPeriodEnd ?? now;
        const coverageStart = base > now ? base : now;
        const coverageEnd = new Date(coverageStart);
        coverageEnd.setMonth(coverageEnd.getMonth() + months);

        await prisma.$transaction(async (tx) => {
          const payment = await tx.saaSPayment.create({
            data: {
              tenantId: id,
              amount,
              outletCount,
              unitPrice: amount / months / outletCount,
              monthsPurchased: months,
              status: "PAID",
              kind: String(body?.kind ?? "RENEWAL"),
              coverageStart,
              coverageEnd,
              paidAt: now,
            },
          });

          if (tenant.subscription) {
            await tx.subscription.update({
              where: { tenantId: id },
              data: {
                status: "ACTIVE",
                currentPeriodStart: coverageStart,
                currentPeriodEnd: coverageEnd,
                paidOutletCount: outletCount,
              },
            });
          }

          await auditLog(tx, {
            actor,
            action: "subscription.mark_paid",
            target: { type: "SaaSPayment", id: payment.id, tenantId: id },
            reason,
            diff: { amount, months, outletCount, coverageEnd: coverageEnd.toISOString() },
            req,
          });
        });

        return apiSuccess({ op: op as string, ok: true });
      }
    }
  },
);
