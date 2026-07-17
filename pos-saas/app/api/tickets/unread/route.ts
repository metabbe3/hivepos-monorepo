import { withErrorHandler, apiSuccess, UnauthenticatedError } from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

async function requireTenantUser() {
  const session = await getApiSession();
  if (!session?.user?.id || session.user.role === "SUPER_ADMIN") {
    throw new UnauthenticatedError();
  }
  return session;
}

// ponytail: AuditLog already records ticket.* actions with tenantId set by
// the auditLog helper (lib/audit.ts). We just query it — no new table.
export const GET = withErrorHandler(async () => {
  const session = await requireTenantUser();
  const userId = session.user.id;
  const tenantId = session.user.tenantId;

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { lastTicketEventReadAt: true },
  });

  // Recent admin-side ticket events for this tenant.
  const events = await prisma.auditLog.findMany({
    where: {
      tenantId,
      action: { startsWith: "ticket." },
      ...(me.lastTicketEventReadAt
        ? { createdAt: { gt: me.lastTicketEventReadAt } }
        : {}),
      actorId: { not: userId },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      action: true,
      targetId: true,
      createdAt: true,
      actorEmail: true,
    },
  });

  const unreadCount = events.length;
  return apiSuccess({
    unreadCount,
    lastReadAt: me.lastTicketEventReadAt?.toISOString() ?? null,
    events: events.map((e) => ({
      id: e.id,
      kind: e.action,
      ticketId: e.targetId,
      actorEmail: e.actorEmail,
      createdAt: e.createdAt.toISOString(),
    })),
  });
});

export const POST = withErrorHandler(async () => {
  const session = await requireTenantUser();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastTicketEventReadAt: new Date() },
  });
  return apiSuccess({ ok: true });
});
