import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  NotFoundError,
  ValidationError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { invalidateFeatureFlags } from "@/lib/feature-flags";

// GET — search tenants, with their override status for this flag
// ?q=foo  → search by name/slug
export const GET = withErrorHandler(async (req, ctx) => {
  await assertSuperAdminOrThrow();
  const { id } = await ctx!.params;
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const overrideOnly = url.searchParams.get("overrideOnly") === "true";

  const flag = await prisma.featureFlag.findUnique({ where: { id } });
  if (!flag) throw new NotFoundError("Flag not found");

  const where: Record<string, unknown> = { isActive: true };
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { slug: { contains: q, mode: "insensitive" } },
    ];
  }

  const tenants = await prisma.tenant.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      featureFlags: { where: { flagId: id }, select: { enabled: true, reason: true } },
    },
    orderBy: { name: "asc" },
    take: 100,
  });

  const rows = tenants
    .map((t) => {
      const ov = t.featureFlags[0];
      return {
        tenantId: t.id,
        tenantName: t.name,
        tenantSlug: t.slug,
        overrideEnabled: ov?.enabled ?? null,
        reason: ov?.reason ?? null,
        effective: ov ? ov.enabled : flag.enabled,
      };
    })
    .filter((r) => (overrideOnly ? r.overrideEnabled !== null : true));

  return apiSuccess({ flagId: id, flagEnabled: flag.enabled, tenants: rows });
});

// POST — upsert per-tenant override
// Body: { tenantId, enabled, reason? }
export const POST = withErrorHandler(async (req, ctx) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };
  const { id } = await ctx!.params;

  const body = await req.json().catch(() => ({}));
  const tenantId = typeof body?.tenantId === "string" ? body.tenantId : "";
  if (!tenantId) throw new ValidationError("tenantId is required");
  if (typeof body?.enabled !== "boolean")
    throw new ValidationError("enabled (boolean) is required");

  const reason =
    typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : null;

  const flag = await prisma.featureFlag.findUnique({ where: { id } });
  if (!flag) throw new NotFoundError("Flag not found");
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new NotFoundError("Tenant not found");

  const updated = await prisma.$transaction(async (tx) => {
    const ov = await tx.tenantFeatureFlag.upsert({
      where: { flagId_tenantId: { flagId: id, tenantId } },
      update: { enabled: body.enabled, reason },
      create: { flagId: id, tenantId, enabled: body.enabled, reason },
    });
    await auditLog(tx, {
      actor,
      action: "featureFlag.tenantOverride",
      target: { type: "FeatureFlag", id },
      diff: {
        tenantId,
        tenantName: tenant.name,
        flagKey: flag.key,
        enabled: body.enabled,
        reason,
      },
      req,
    });
    return ov;
  });

  invalidateFeatureFlags(tenantId); // per-tenant override changed

  return apiSuccess({ override: { id: updated.id, tenantId, enabled: updated.enabled } });
});
