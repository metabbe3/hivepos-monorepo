import { NextResponse } from "next/server";
import { withErrorHandler, parseBody, apiSuccess, apiCreated, UnauthenticatedError } from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { tenantTicketSchema } from "@/lib/validations";
import { createTenantTicket, listTicketsForUser } from "@/lib/tickets-tenant";

// ponytail: no RBAC — every logged-in tenant user gets ticket access.
async function requireTenantUser() {
  const session = await getApiSession();
  if (!session?.user?.id || session.user.role === "SUPER_ADMIN") {
    throw new UnauthenticatedError();
  }
  return session;
}

export const GET = withErrorHandler(async (req) => {
  const session = await requireTenantUser();
  const tickets = await listTicketsForUser(session.user.id, session.user.tenantId);
  return apiSuccess(tickets);
});

export const POST = withErrorHandler(async (req) => {
  const session = await requireTenantUser();
  const input = await parseBody(req, tenantTicketSchema);

  // Refresh name/email/phone from DB so the snapshot stays accurate even if
  // the user edited their profile after the JWT was issued.
  const me = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, tenantId: true },
  });

  const ticket = await createTenantTicket({
    subject: input.subject,
    description: input.description,
    category: input.category,
    priority: input.priority,
    user: me,
    req,
  });

  return apiCreated(ticket);
});
