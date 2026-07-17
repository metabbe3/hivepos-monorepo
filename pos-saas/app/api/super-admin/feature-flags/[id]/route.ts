import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess, NotFoundError } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { invalidateFeatureFlags } from "@/lib/feature-flags";

// GET — single flag with overrides expanded (tenant name + enabled + reason)
export const GET = withErrorHandler(async (_req, ctx) => {
  await assertSuperAdminOrThrow();
  const { id } = await ctx!.params;

  const flag = await prisma.featureFlag.findUnique({
    where: { id },
    include: {
      overrides: {
        orderBy: { createdAt: "desc" },
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      },
    },
  });
  if (!flag) throw new NotFoundError("Flag not found");

  return apiSuccess({
    flag: {
      id: flag.id,
      key: flag.key,
      name: flag.name,
      description: flag.description,
      enabled: flag.enabled,
      category: flag.category,
      updatedAt: flag.updatedAt.toISOString(),
      overrides: flag.overrides.map((o) => ({
        id: o.id,
        tenantId: o.tenantId,
        tenantName: o.tenant.name,
        tenantSlug: o.tenant.slug,
        enabled: o.enabled,
        reason: o.reason,
        updatedAt: o.updatedAt.toISOString(),
      })),
    },
  });
});

// PATCH — update flag metadata or global toggle
export const PATCH = withErrorHandler(async (req, ctx) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };
  const { id } = await ctx!.params;

  const body = await req.json().catch(() => ({}));

  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Flag not found");

  const data: Record<string, unknown> = {};
  if (typeof body?.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body?.description === "string") data.description = body.description.trim() || null;
  if (typeof body?.category === "string" && body.category.trim()) data.category = body.category.trim();
  if (typeof body?.enabled === "boolean") data.enabled = body.enabled;

  const updated = await prisma.$transaction(async (tx) => {
    const flag = await tx.featureFlag.update({ where: { id }, data });
    const diff: Record<string, unknown> = {};
    for (const k of Object.keys(data)) diff[k] = data[k];
    await auditLog(tx, {
      actor,
      action: "featureFlag.update",
      target: { type: "FeatureFlag", id: flag.id },
      diff,
      req,
    });
    return flag;
  });

  invalidateFeatureFlags(); // global default changed → all tenants

  return apiSuccess({ flag: { id: updated.id, key: updated.key, enabled: updated.enabled } });
});

// DELETE — remove flag (cascade clears overrides)
export const DELETE = withErrorHandler(async (req, ctx) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };
  const { id } = await ctx!.params;

  const existing = await prisma.featureFlag.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Flag not found");

  await prisma.$transaction(async (tx) => {
    await tx.featureFlag.delete({ where: { id } });
    await auditLog(tx, {
      actor,
      action: "featureFlag.delete",
      target: { type: "FeatureFlag", id },
      diff: { key: existing.key },
      req,
    });
  });

  invalidateFeatureFlags(); // flag deleted → all tenants

  return apiSuccess({ ok: true });
});
