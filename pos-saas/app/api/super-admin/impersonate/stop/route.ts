import {
  withErrorHandler,
  apiSuccess,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";

// POST — stop impersonating. Authorizes + audit logs.
// The JWT restore happens in lib/auth.ts jwt callback when the client calls
// session.update({ stopImpersonation: true }). Requires preImpersonation present
// in the current token (set when impersonation started), enforced there.
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  // session.user.id is the *target* during impersonation; session.user.impersonating
  // tells us the snapshot is present. session.user.impersonatedEmail carries the target.
  const targetEmail = (session.user as any).impersonatedEmail ?? null;

  await auditLog(prisma, {
    actor,
    action: "user.impersonate_stop",
    target: targetEmail
      ? { type: "User", id: session.user.id! }
      : { type: "SuperAdmin", id: actor.id },
    diff: targetEmail ? { targetEmail } : { note: "no active impersonation" },
    req,
  });

  return apiSuccess({ ok: true });
});
