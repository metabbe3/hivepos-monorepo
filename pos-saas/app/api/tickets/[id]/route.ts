import { withErrorHandler, apiSuccess, UnauthenticatedError } from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";
import { getTicketForUser } from "@/lib/tickets-tenant";

async function requireTenantUser() {
  const session = await getApiSession();
  if (!session?.user?.id || session.user.role === "SUPER_ADMIN") {
    throw new UnauthenticatedError();
  }
  return session;
}

export const GET = withErrorHandler(async (_req, ctx) => {
  const session = await requireTenantUser();
  const { id: ticketId } = await ctx!.params;
  const ticket = await getTicketForUser(ticketId, session.user.id, session.user.tenantId);
  return apiSuccess(ticket);
});
