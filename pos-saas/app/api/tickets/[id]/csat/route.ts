import { withErrorHandler, parseBody, apiSuccess, UnauthenticatedError } from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";
import { ticketCsatSchema } from "@/lib/validations";
import { setCsatRating } from "@/lib/tickets-tenant";

async function requireTenantUser() {
  const session = await getApiSession();
  if (!session?.user?.id || session.user.role === "SUPER_ADMIN") {
    throw new UnauthenticatedError();
  }
  return session;
}

export const POST = withErrorHandler(async (req, ctx) => {
  const session = await requireTenantUser();
  const { id: ticketId } = await ctx!.params;
  const input = await parseBody(req, ticketCsatSchema);

  const result = await setCsatRating(ticketId, session.user.id, input.rating, input.comment);
  return apiSuccess(result);
});
