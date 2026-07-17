import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
  ConflictError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { invalidatePlanCache } from "@/lib/billing";

// GET — list all plans with subscription counts
export const GET = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow();

  const plans = await prisma.plan.findMany({
    orderBy: [{ priceMonthly: "asc" }, { name: "asc" }],
    include: { _count: { select: { subscriptions: true } } },
  });

  return apiSuccess({
    plans: plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      maxOutlets: p.maxOutlets,
      maxUsers: p.maxUsers,
      maxOrders: p.maxOrders,
      priceMonthly: Number(p.priceMonthly),
      priceYearly: Number(p.priceYearly),
      modules: p.modules,
      features: p.features,
      isActive: p.isActive,
      tier: p.tier,
      subscriptionCount: p._count.subscriptions,
      createdAt: p.createdAt.toISOString(),
    })),
  });
});

// POST — create a plan
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json().catch(() => ({}));

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) throw new ValidationError("Nama wajib diisi.");

  const priceMonthly = parseDecimal(body?.priceMonthly, "priceMonthly");
  const priceYearly = parseDecimal(body?.priceYearly, "priceYearly");

  const maxOutlets = parsePositiveInt(body?.maxOutlets, 1, "maxOutlets");
  const maxUsers = parsePositiveInt(body?.maxUsers, 1, "maxUsers");
  const maxOrders = parsePositiveInt(body?.maxOrders, 0, "maxOrders");

  const modules = Array.isArray(body?.modules)
    ? body.modules.filter((m: unknown): m is string => typeof m === "string")
    : [];

  const tier =
    body?.tier === "FREE" || body?.tier === "GROWTH" || body?.tier === "PRO"
      ? body.tier
      : null;

  const existing = await prisma.plan.findUnique({ where: { name } });
  if (existing) throw new ConflictError("Plan name already exists");

  const created = await prisma.$transaction(async (tx) => {
    const plan = await tx.plan.create({
      data: {
        name,
        description: typeof body?.description === "string" ? body.description.trim() || null : null,
        maxOutlets,
        maxUsers,
        maxOrders,
        priceMonthly,
        priceYearly,
        modules,
        features: (body?.features ?? null) as any,
        tier,
        isActive: body?.isActive !== false,
      },
    });
    await auditLog(tx, {
      actor,
      action: "plan.create",
      target: { type: "Plan", id: plan.id },
      diff: { name, priceMonthly: Number(priceMonthly), priceYearly: Number(priceYearly) },
      req,
    });
    return plan;
  });

  invalidatePlanCache(); // new plan → tier prices / growth id may change

  return apiSuccess({ plan: { id: created.id, name: created.name } });
});

function parseDecimal(v: unknown, field: string): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${field} must be a non-negative number`);
  return n;
}

function parsePositiveInt(v: unknown, fallback: number, field: string): number {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n) || n < 0) throw new ValidationError(`${field} must be a non-negative integer`);
  return n;
}
