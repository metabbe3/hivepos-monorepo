import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { updateTicketField, TICKET_STATUSES } from "@/lib/tickets";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { ticketStatusEmail } from "@/lib/email-templates/ticket-events";

export const POST = withErrorHandler(
  async (req: Request, ctx) => {
    const { session } = await assertSuperAdminOrThrow();
    const actor = { id: session.user.id!, email: session.user.email! };
    const { id } = await ctx!.params;

    const body = await req.json().catch(() => ({}));
    const status = typeof body?.status === "string" ? body.status : "";
    if (!(TICKET_STATUSES as readonly string[]).includes(status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${TICKET_STATUSES.join(", ")}`);
    }
    const reason =
      typeof body?.reason === "string" ? body.reason.trim() || null : null;

    await updateTicketField(id, "status", status, actor, req);

    // ponytail: best-effort email — errors swallowed inside sendEmail.
    const t = await prisma.supportTicket.findUnique({
      where: { id },
      select: { subject: true, submitterName: true, submitterEmail: true },
    });
    if (t) {
      const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
      await sendEmail({
        to: t.submitterEmail,
        ...ticketStatusEmail({
          ticketId: id,
          ticketSubject: t.subject,
          submitterName: t.submitterName,
          newStatus: status,
          appUrl,
        }),
      }).catch(() => {});
    }

    return apiSuccess({ ticket: { id, status } });
  },
);
