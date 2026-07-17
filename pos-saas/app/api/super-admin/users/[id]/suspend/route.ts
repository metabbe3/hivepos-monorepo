import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { suspendUser, reactivateUser } from "@/lib/user-admin";

// POST → suspend user (isActive=false + sessionVersion++). Reason ≥10 chars required.
export const POST = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow();
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    if (reason.length < 10) {
      throw new ValidationError("Alasan terlalu pendek — minimal 10 huruf.");
    }
    await suspendUser(id, actor, reason, req);
    return apiSuccess({ user: { id, isActive: false } });
  },
);

// DELETE → reactivate user. Optional reason.
export const DELETE = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow();
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));
    const reason = typeof body?.reason === "string" ? body.reason.trim() || null : null;
    await reactivateUser(id, actor, reason, req);
    return apiSuccess({ user: { id, isActive: true } });
  },
);
