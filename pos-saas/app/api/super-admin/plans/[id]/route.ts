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
import { invalidatePlanCache } from "@/lib/billing";

// PATCH — update plan fields. Cannot rename to a name already in use by another plan.
export const PATCH = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));

    const plan = await prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundError("Plan", id);

    const data: Record<string, unknown> = {};

    if (typeof body?.name === "string") {
      const name = body.name.trim();
      if (!name) throw new ValidationError("Name cannot be empty");
      if (name !== plan.name) {
        const clash = await prisma.plan.findUnique({ where: { name } });
        if (clash) throw new ConflictError("Plan name already exists");
        data.name = name;
      }
    }

    if (body?.description !== undefined) {
      data.description =
        typeof body.description === "string" ? body.description.trim() || null : null;
    }

    if (body?.priceMonthly !== undefined) data.priceMonthly = toDecimal(body.priceMonthly, "priceMonthly");
    if (body?.priceYearly !== undefined) data.priceYearly = toDecimal(body.priceYearly, "priceYearly");
    if (body?.maxOutlets !== undefined) data.maxOutlets = toPosInt(body.maxOutlets, "maxOutlets");
    if (body?.maxUsers !== undefined) data.maxUsers = toPosInt(body.maxUsers, "maxUsers");
    if (body?.maxOrders !== undefined) data.maxOrders = toPosInt(body.maxOrders, "maxOrders");
    if (Array.isArray(body?.modules)) {
      data.modules = body.modules.filter((m: unknown): m is string => typeof m === "string");
    }
    if (body?.features !== undefined) data.features = body.features as any;
    if (body?.tier !== undefined) {
      data.tier =
        body.tier === "FREE" || body.tier === "GROWTH" || body.tier === "PRO"
          ? body.tier
          : null;
    }
    if (typeof body?.isActive === "boolean") data.isActive = body.isActive;

    if (Object.keys(data).length === 0) {
      return apiSuccess({ plan: { id, name: plan.name } });
    }

    const before = {
      name: plan.name,
      priceMonthly: Number(plan.priceMonthly),
      priceYearly: Number(plan.priceYearly),
      isActive: plan.isActive,
    };

    const updated = await prisma.$transaction(async (tx) => {
      const p = await tx.plan.update({ where: { id }, data });
      await auditLog(tx, {
        actor,
        action: data.isActive === false ? "plan.deactivate" : "plan.update",
        target: { type: "Plan", id },
        diff: { before, after: data },
        req,
      });
      return p;
    });

    invalidatePlanCache(); // plan pricing/fields changed

    return apiSuccess({ plan: { id: updated.id, name: updated.name } });
  },
);

// DELETE — only allowed if no subscriptions reference the plan.
export const DELETE = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;

    const plan = await prisma.plan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });
    if (!plan) throw new NotFoundError("Plan", id);
    if (plan._count.subscriptions > 0) {
      throw new ConflictError(
        `Cannot delete: ${plan._count.subscriptions} subscription(s) still on this plan. Deactivate instead.`,
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.plan.delete({ where: { id } });
      await auditLog(tx, {
        actor,
        action: "plan.delete",
        target: { type: "Plan", id },
        diff: { name: plan.name },
        req,
      });
    });

    invalidatePlanCache(); // plan deleted

    return apiSuccess({ deleted: id });
  },
);

function toDecimal(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${field} must be a non-negative number`);
  return n;
}

function toPosInt(v: unknown, field: string): number {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${field} must be a non-negative integer`);
  return n;
}
