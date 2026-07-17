import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess, ValidationError } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { invalidateFeatureFlags } from "@/lib/feature-flags";

// GET — list all flags with override counts
export const GET = withErrorHandler(async () => {
  await assertSuperAdminOrThrow();

  const flags = await prisma.featureFlag.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
    include: { _count: { select: { overrides: true } } },
  });

  return apiSuccess({
    flags: flags.map((f) => ({
      id: f.id,
      key: f.key,
      name: f.name,
      description: f.description,
      enabled: f.enabled,
      category: f.category,
      overrideCount: f._count.overrides,
      updatedAt: f.updatedAt.toISOString(),
    })),
  });
});

// POST — create a new flag (or upsert by key)
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!key) throw new ValidationError("key is required");
  if (!name) throw new ValidationError("name is required");

  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;
  const category =
    typeof body?.category === "string" && body.category.trim()
      ? body.category.trim()
      : "general";

  const created = await prisma.$transaction(async (tx) => {
    const flag = await tx.featureFlag.create({
      data: {
        key,
        name,
        description,
        category,
        enabled: body?.enabled !== false,
      },
    });
    await auditLog(tx, {
      actor,
      action: "featureFlag.create",
      target: { type: "FeatureFlag", id: flag.id },
      diff: { key, name, enabled: flag.enabled },
      req,
    });
    return flag;
  });

  invalidateFeatureFlags(); // new global flag → clear all tenants

  return apiSuccess({ flag: { id: created.id, key: created.key } });
});
