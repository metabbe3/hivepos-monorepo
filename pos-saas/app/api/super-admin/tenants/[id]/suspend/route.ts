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

// POST → suspend. Requires `reason` (≥10 chars). Errors if already suspended.
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

    const tenant = await prisma.tenant.findUnique({ where: { id }, select: { isActive: true } });
    if (!tenant) throw new NotFoundError("Tenant", id);
    if (!tenant.isActive) {
      throw new ConflictError("Tenant is already suspended");
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id }, data: { isActive: false } });
      await auditLog(tx, {
        actor,
        action: "tenant.suspend",
        target: { type: "Tenant", id, tenantId: id },
        reason,
        diff: { isActive: { from: true, to: false } },
        req,
      });
    });

    return apiSuccess({ tenant: { id, isActive: false } });
  },
);

// DELETE → reactivate. Optional reason.
export const DELETE = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;

    const tenant = await prisma.tenant.findUnique({ where: { id }, select: { isActive: true } });
    if (!tenant) throw new NotFoundError("Tenant", id);
    if (tenant.isActive) {
      throw new ConflictError("Tenant is already active");
    }

    await prisma.$transaction(async (tx) => {
      await tx.tenant.update({ where: { id }, data: { isActive: true } });
      await auditLog(tx, {
        actor,
        action: "tenant.reactivate",
        target: { type: "Tenant", id, tenantId: id },
        reason,
        diff: { isActive: { from: false, to: true } },
        req,
      });
    });

    return apiSuccess({ tenant: { id, isActive: true } });
  },
);
