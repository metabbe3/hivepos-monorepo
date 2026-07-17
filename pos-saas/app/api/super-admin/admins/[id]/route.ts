import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
  NotFoundError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

// PATCH — update role (SUPPORT ↔ SUPER_ADMIN). Cannot demote yourself.
export const PATCH = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));

    const admin = await prisma.superAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundError("SuperAdmin", id);

    if (id === actor.id) {
      throw new ValidationError("Cannot change your own role");
    }

    const role = body?.role === "SUPPORT" ? "SUPPORT" : "SUPER_ADMIN";
    if (role === admin.role) {
      return apiSuccess({ admin: { id, role } });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const a = await tx.superAdmin.update({
        where: { id },
        data: { role },
      });
      await auditLog(tx, {
        actor,
        action: "admin.update_role",
        target: { type: "SuperAdmin", id },
        diff: { role: { from: admin.role, to: role } },
        req,
      });
      return a;
    });

    return apiSuccess({ admin: { id: updated.id, role: updated.role } });
  },
);

// DELETE — deactivate by bumping sessionVersion + setting a tombstone flag.
// We don't hard-delete to preserve audit-log referential integrity.
// For simplicity we soft-delete: email gets a "deleted-" prefix so it can be reused,
// and the row stays queryable. Toggle isActive when you add that column if needed.
export const DELETE = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;

    const admin = await prisma.superAdmin.findUnique({ where: { id } });
    if (!admin) throw new NotFoundError("SuperAdmin", id);

    if (id === actor.id) {
      throw new ValidationError("Cannot deactivate yourself");
    }

    await prisma.$transaction(async (tx) => {
      // ponytail: rename email to free up the address; bump sessionVersion to kill tokens.
      await tx.superAdmin.update({
        where: { id },
        data: {
          sessionVersion: { increment: 1 },
          email: `deleted-${Date.now()}-${admin.email}`,
          name: `${admin.name} (deactivated)`,
        },
      });
      await auditLog(tx, {
        actor,
        action: "admin.deactivate",
        target: { type: "SuperAdmin", id },
        diff: { email: admin.email },
        req,
      });
    });

    return apiSuccess({ deactivated: id });
  },
);
