import { withErrorHandler, parseBody, apiCreated } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { prisma } from "@/lib/prisma";
import { ticketCommentSchema } from "@/lib/validations";
import { addAdminComment } from "@/lib/tickets-admin";

export const POST = withErrorHandler(async (req, ctx) => {
  const { session } = await assertSuperAdminOrThrow();
  const { id: ticketId } = await ctx!.params;
  const input = await parseBody(req, ticketCommentSchema);

  const admin = await prisma.superAdmin.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, email: true, name: true, role: true },
  });

  const comment = await addAdminComment({
    ticketId,
    body: input.body,
    admin: {
      id: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
    },
    req,
  });

  return apiCreated(comment);
});
