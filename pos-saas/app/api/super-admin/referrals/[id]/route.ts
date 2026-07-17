import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  NotFoundError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

// PATCH — void a referral (mark REJECTED) so it can never reward. Audit-logged.
// Used when super-admin detects abuse. Does NOT claw back an already-granted
// reward (coverage extension) — only blocks future reward on a still-PENDING one.
export const PATCH = withErrorHandler(async (req, ctx) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const { id } = await ctx!.params;

  const existing = await prisma.referral.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Referral", id);

  await prisma.$transaction(async (tx) => {
    await tx.referral.update({
      where: { id },
      data: { status: "REJECTED", reason: "voided_by_admin" },
    });
    await auditLog(tx, {
      actor: { id: session.user.id!, email: session.user.email! },
      action: "referral.void",
      target: { type: "Referral", id },
      diff: { from: existing.status, to: "REJECTED" },
      req,
    });
  });

  return apiSuccess({ ok: true });
});
