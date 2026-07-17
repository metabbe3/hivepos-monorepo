import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { setErrorLogResolved } from "@/lib/error-logs";

// POST → mark resolved. Optional reason.
export const POST = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow();
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() || null : null;

    await setErrorLogResolved(id, true, actor, req, reason);

    return apiSuccess({ errorLog: { id, resolved: true } });
  },
);

// DELETE → mark unresolved. Optional reason.
export const DELETE = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow();
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;
    const body = await req.json().catch(() => ({}));
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() || null : null;

    await setErrorLogResolved(id, false, actor, req, reason);

    return apiSuccess({ errorLog: { id, resolved: false } });
  },
);
