import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { resetUserPassword } from "@/lib/user-admin";

// POST → reset password. SUPER_ADMIN only. Reason ≥10 chars required.
// Returns a temp password the admin hands to the user out-of-band.
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
    const tempPassword = await resetUserPassword(id, actor, reason, req);
    return apiSuccess({ tempPassword });
  },
);
