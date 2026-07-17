import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

// POST — revoke all other sessions for the current admin by bumping sessionVersion.
// The current session stays valid until the JWT callback picks up the new version
// (next request), at which point the server compares and forces re-auth.
// To keep the *current* session alive, the client must re-issue a session update
// after this call — see the settings page handler.
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow();
  const actor = { id: session.user.id!, email: session.user.email! };

  await prisma.$transaction(async (tx) => {
    const updated = await tx.superAdmin.update({
      where: { id: actor.id },
      data: { sessionVersion: { increment: 1 } },
      select: { sessionVersion: true },
    });
    await auditLog(tx, {
      actor,
      action: "admin.revoke_sessions",
      target: { type: "SuperAdmin", id: actor.id },
      diff: { sessionVersion: updated.sessionVersion },
      req,
    });
  });

  return apiSuccess({ ok: true });
});
