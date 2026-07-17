import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { updateTicketField, TICKET_PRIORITIES } from "@/lib/tickets";

export const POST = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow();
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;

    const body = await req.json().catch(() => ({}));
    const priority = typeof body?.priority === "string" ? body.priority : "";
    if (!(TICKET_PRIORITIES as readonly string[]).includes(priority)) {
      throw new ValidationError(
        `Invalid priority. Must be one of: ${TICKET_PRIORITIES.join(", ")}`,
      );
    }
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() || null : null;

    await updateTicketField(id, "priority", priority, actor, req);

    return apiSuccess({ ticket: { id, priority } });
  },
);
