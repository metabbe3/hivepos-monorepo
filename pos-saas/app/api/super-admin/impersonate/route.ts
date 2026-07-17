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

// POST { userId } — start impersonating a tenant user.
// The actual JWT swap happens in lib/auth.ts jwt callback when the client calls
// session.update({ impersonateUserId }). This endpoint authorizes + audit logs first.
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json().catch(() => ({}));
  const userId = typeof body?.userId === "string" ? body.userId : "";
  if (!userId) throw new ValidationError("userId is required");

  const target = await prisma.user.findUnique({
    where: { id: userId },
    include: { tenant: true },
  });
  if (!target) throw new NotFoundError("User", userId);
  if (!target.isActive) throw new ConflictError("Target user is not active");
  if (!target.tenant?.isActive) throw new ConflictError("Target tenant is suspended");

  await auditLog(prisma, {
    actor,
    action: "user.impersonate",
    target: { type: "User", id: target.id, tenantId: target.tenantId ?? undefined },
    diff: { targetEmail: target.email, tenantId: target.tenantId },
    req,
  });

  return apiSuccess({
    impersonateUserId: target.id,
    redirectTo: "/dashboard",
  });
});
