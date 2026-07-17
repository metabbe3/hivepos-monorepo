import { prisma } from "@/lib/prisma";
import { auditLog, type AuditActor } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/modules/shared";
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@/lib/tickets-constants";

export {
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/tickets-constants";

export type CreateTicketInput = {
  subject: string;
  description: string;
  category?: TicketCategory;
  submitterName: string;
  submitterEmail: string;
  submitterPhone?: string | null;
  tenantId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export async function createPublicTicket(input: CreateTicketInput) {
  return prisma.supportTicket.create({
    data: {
      subject: input.subject,
      description: input.description,
      category: input.category ?? "OTHER",
      submitterName: input.submitterName,
      submitterEmail: input.submitterEmail,
      submitterPhone: input.submitterPhone ?? null,
      tenantId: input.tenantId ?? null,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
    select: { id: true },
  });
}

export type TicketFilters = {
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  tenantId?: string;
  page: number;
  pageSize: number;
};

export async function getTickets(filters: TicketFilters) {
  const where = {
    ...(filters.status && { status: filters.status }),
    ...(filters.priority && { priority: filters.priority }),
    ...(filters.category && { category: filters.category }),
    ...(filters.tenantId && { tenantId: filters.tenantId }),
  };

  // ponytail: take +1 to detect "has next page" — mirrors lib/audit-query.ts.
  // SupportTicket.tenantId is a plain string (no relation), so we resolve names
  // in a second query only when at least one row has a tenantId.
  const rows = await prisma.supportTicket.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize + 1,
    select: {
      id: true,
      subject: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      tenantId: true,
      submitterName: true,
      submitterEmail: true,
      submitterPhone: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      csatRating: true,
      _count: { select: { comments: true } },
    },
  });

  const tenantIds = Array.from(
    new Set(rows.map((r) => r.tenantId).filter((x): x is string => !!x)),
  );
  const tenants =
    tenantIds.length > 0
      ? await prisma.tenant.findMany({
          where: { id: { in: tenantIds } },
          select: { id: true, name: true },
        })
      : [];
  const tenantName = new Map(tenants.map((t) => [t.id, t.name]));

  const hasNext = rows.length > filters.pageSize;
  return {
    rows: rows.slice(0, filters.pageSize).map((t) => ({
      id: t.id,
      subject: t.subject,
      description: t.description,
      category: t.category,
      priority: t.priority,
      status: t.status,
      tenantId: t.tenantId,
      tenantName: (t.tenantId && tenantName.get(t.tenantId)) ?? null,
      submitterName: t.submitterName,
      submitterEmail: t.submitterEmail,
      submitterPhone: t.submitterPhone,
      createdAt: t.createdAt.toISOString(),
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      closedAt: t.closedAt?.toISOString() ?? null,
      csatRating: t.csatRating,
      commentCount: t._count.comments,
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasNext,
  };
}

export async function updateTicketField(
  ticketId: string,
  field: "status" | "priority",
  nextValue: string,
  actor: AuditActor,
  req: Request | null,
) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, priority: true, tenantId: true },
  });
  if (!ticket) throw new NotFoundError("SupportTicket", ticketId);

  const currentValue = ticket[field];
  if (currentValue === nextValue) {
    throw new ConflictError(`Ticket ${field} is already ${nextValue}`);
  }

  const data: Record<string, unknown> = { [field]: nextValue };
  if (field === "status") {
    if (nextValue === "RESOLVED") data.resolvedAt = new Date();
    if (nextValue === "CLOSED") data.closedAt = new Date();
  }

  await prisma.$transaction(async (tx) => {
    await tx.supportTicket.update({ where: { id: ticketId }, data });
    await auditLog(tx, {
      actor,
      action: field === "status" ? "ticket.update_status" : "ticket.update_priority",
      target: { type: "SupportTicket", id: ticketId, tenantId: ticket.tenantId },
      diff: { [field]: { from: currentValue, to: nextValue } },
      req,
    });
  });
}
