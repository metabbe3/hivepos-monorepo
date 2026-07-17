import { withErrorHandler, apiSuccess, ValidationError } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Owner/Manager override: edit + delete a clock event.

const patchSchema = z.object({
  timestamp: z.string().datetime().optional(),
  type: z.enum(["CLOCK_IN", "CLOCK_OUT"]).optional(),
});

export const PATCH = withErrorHandler(async (req, ctxParams) => {
  const ctx = await requirePermissionOrThrow("attendance", "edit");
  const { id } = await ctxParams!.params;
  const parsed = patchSchema.parse(await req.json());

  const existing = await prisma.clockEvent.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) throw new ValidationError("Event not found");

  const data: { timestamp?: Date; type?: "CLOCK_IN" | "CLOCK_OUT" } = {};
  if (parsed.timestamp) data.timestamp = new Date(parsed.timestamp);
  if (parsed.type) data.type = parsed.type;

  const updated = await prisma.clockEvent.update({
    where: { id },
    data,
    include: { user: { select: { name: true } }, branch: { select: { name: true } } },
  });

  return apiSuccess({
    id: updated.id,
    userId: updated.userId,
    userName: updated.user.name,
    type: updated.type,
    timestamp: updated.timestamp.toISOString(),
    branchId: updated.branchId,
    branchName: updated.branch.name,
  });
});

export const DELETE = withErrorHandler(async (req, ctxParams) => {
  const ctx = await requirePermissionOrThrow("attendance", "edit");
  const { id } = await ctxParams!.params;

  const existing = await prisma.clockEvent.findFirst({
    where: { id, tenantId: ctx.tenantId },
  });
  if (!existing) throw new ValidationError("Event not found");

  await prisma.clockEvent.delete({ where: { id } });
  return apiSuccess({ ok: true });
});
