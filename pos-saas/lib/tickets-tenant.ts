/**
 * Tenant-side ticket operations. Scope: a user sees their own tenant's tickets
 * (any submitter in the same tenant) plus any ticket they personally submitted
 * (even if tenantId failed to resolve). RBAC-free — every logged-in tenant user
 * gets ticket access.
 */
import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/modules/shared";
import type { TicketCategory, TicketPriority } from "@/lib/tickets-constants";

export type TenantTicketSummary = {
  id: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
  createdAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  csatRating: number | null;
  commentCount: number;
};

export async function createTenantTicket(input: {
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  user: { id: string; name: string; email: string; phone?: string | null; tenantId: string };
  req?: Request | null;
}) {
  const ticket = await prisma.supportTicket.create({
    data: {
      subject: input.subject,
      description: input.description,
      category: input.category,
      priority: input.priority,
      tenantId: input.user.tenantId,
      submitterName: input.user.name,
      submitterEmail: input.user.email,
      submitterPhone: input.user.phone ?? null,
      submittedById: input.user.id,
      userAgent: input.req?.headers.get("user-agent") ?? null,
    },
    select: { id: true },
  });
  return ticket;
}

export async function listTicketsForUser(userId: string, tenantId: string) {
  // ponytail: no pager — tenant ticket volume is tiny (typ. <50/tenant).
  // Add cursor pager if a tenant ever exceeds ~500.
  const rows = await prisma.supportTicket.findMany({
    where: {
      OR: [{ submittedById: userId }, { tenantId }],
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      subject: true,
      description: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
      resolvedAt: true,
      closedAt: true,
      csatRating: true,
      _count: { select: { comments: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    description: r.description,
    category: r.category,
    priority: r.priority,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    closedAt: r.closedAt?.toISOString() ?? null,
    csatRating: r.csatRating,
    commentCount: r._count.comments,
  })) satisfies TenantTicketSummary[];
}

export async function getTicketForUser(ticketId: string, userId: string, tenantId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        select: { id: true, authorName: true, authorRole: true, body: true, createdAt: true },
      },
    },
  });

  if (!ticket) throw new NotFoundError("SupportTicket", ticketId);

  // ponytail: OR scope — own ticket OR same tenant. Prevents cross-tenant leak.
  const isOwn = ticket.submittedById === userId;
  const sameTenant = ticket.tenantId && ticket.tenantId === tenantId;
  if (!isOwn && !sameTenant) {
    throw new ForbiddenError("You do not have access to this ticket");
  }

  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    csatRating: ticket.csatRating,
    csatComment: ticket.csatComment,
    submitterName: ticket.submitterName,
    submitterEmail: ticket.submitterEmail,
    comments: ticket.comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      authorRole: c.authorRole,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function addTenantComment(input: {
  ticketId: string;
  body: string;
  user: { id: string; name: string; email: string };
}) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, status: true, submittedById: true, tenantId: true },
  });
  if (!ticket) throw new NotFoundError("SupportTicket", input.ticketId);

  // Status flow: a tenant reply on a RESOLVED/CLOSED ticket reopens it.
  const reopen = ["RESOLVED", "CLOSED"].includes(ticket.status);

  return prisma.$transaction(async (tx) => {
    if (reopen) {
      await tx.supportTicket.update({
        where: { id: input.ticketId },
        data: { status: "OPEN", resolvedAt: null },
      });
    }
    return tx.ticketComment.create({
      data: {
        ticketId: input.ticketId,
        authorName: input.user.name,
        authorEmail: input.user.email,
        authorRole: "TENANT_USER",
        body: input.body,
      },
      select: {
        id: true,
        authorName: true,
        authorRole: true,
        body: true,
        createdAt: true,
      },
    });
  });
}

export async function setCsatRating(ticketId: string, userId: string, rating: number, comment?: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    select: { id: true, submittedById: true, tenantId: true, status: true, csatRating: true },
  });
  if (!ticket) throw new NotFoundError("SupportTicket", ticketId);

  const isOwn = ticket.submittedById === userId;
  if (!isOwn) {
    throw new ForbiddenError("Only the submitter can rate this ticket");
  }
  if (!["RESOLVED", "CLOSED"].includes(ticket.status)) {
    throw new ForbiddenError("Ticket must be resolved before rating");
  }
  if (ticket.csatRating !== null) {
    throw new ForbiddenError("This ticket has already been rated");
  }

  return prisma.supportTicket.update({
    where: { id: ticketId },
    data: {
      csatRating: rating,
      csatComment: comment?.trim() || null,
      csatAt: new Date(),
    },
    select: { id: true, csatRating: true },
  });
}
