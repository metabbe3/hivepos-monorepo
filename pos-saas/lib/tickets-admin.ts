/**
 * Super-admin-side ticket operations. No tenant scoping — sees everything.
 */
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/modules/shared";
import { auditLog } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { ticketReplyEmail, ticketStatusEmail } from "@/lib/email-templates/ticket-events";

export async function getAdminTicket(ticketId: string) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: ticketId },
    include: {
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          authorName: true,
          authorEmail: true,
          authorRole: true,
          body: true,
          createdAt: true,
        },
      },
    },
  });

  if (!ticket) throw new NotFoundError("SupportTicket", ticketId);

  // Best-effort tenant name lookup (tenantId is a plain string, not FK).
  let tenantName: string | null = null;
  if (ticket.tenantId) {
    const t = await prisma.tenant.findUnique({
      where: { id: ticket.tenantId },
      select: { name: true },
    });
    tenantName = t?.name ?? null;
  }

  return {
    id: ticket.id,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    tenantId: ticket.tenantId,
    tenantName,
    submitterName: ticket.submitterName,
    submitterEmail: ticket.submitterEmail,
    submitterPhone: ticket.submitterPhone,
    submittedById: ticket.submittedById,
    ipAddress: ticket.ipAddress,
    userAgent: ticket.userAgent,
    csatRating: ticket.csatRating,
    csatComment: ticket.csatComment,
    createdAt: ticket.createdAt.toISOString(),
    resolvedAt: ticket.resolvedAt?.toISOString() ?? null,
    closedAt: ticket.closedAt?.toISOString() ?? null,
    comments: ticket.comments.map((c) => ({
      id: c.id,
      authorName: c.authorName,
      authorEmail: c.authorEmail,
      authorRole: c.authorRole,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}

export async function addAdminComment(input: {
  ticketId: string;
  body: string;
  admin: { id: string; email: string; name: string; role: string };
  req?: Request | null;
}) {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, tenantId: true, status: true },
  });
  if (!ticket) throw new NotFoundError("SupportTicket", input.ticketId);

  const adminLabel = input.admin.role === "SUPER_ADMIN" ? "Admin" : "Support";

  return prisma.$transaction(async (tx) => {
    const comment = await tx.ticketComment.create({
      data: {
        ticketId: input.ticketId,
        authorName: `${input.admin.name} (${adminLabel})`,
        authorEmail: input.admin.email,
        authorRole: input.admin.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "SUPPORT",
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

    // Auto-set IN_PROGRESS if admin replies to a freshly OPEN ticket.
    if (ticket.status === "OPEN") {
      await tx.supportTicket.update({
        where: { id: input.ticketId },
        data: { status: "IN_PROGRESS" },
      });
    }

    await auditLog(tx, {
      actor: { id: input.admin.id, email: input.admin.email },
      action: "ticket.reply",
      target: { type: "SupportTicket", id: input.ticketId, tenantId: ticket.tenantId },
      req: input.req,
    });

    return comment;
  }).then(async (comment) => {
    // Fire-and-forget reply email — ponytail: best-effort, errors swallowed.
    const fullTicket = await prisma.supportTicket.findUniqueOrThrow({
      where: { id: input.ticketId },
      select: { subject: true, submitterName: true, submitterEmail: true },
    });
    const appUrl = process.env.NEXTAUTH_URL ?? process.env.APP_URL ?? "http://localhost:3000";
    await sendEmail({
      to: fullTicket.submitterEmail,
      ...ticketReplyEmail({
        ticketId: input.ticketId,
        ticketSubject: fullTicket.subject,
        submitterName: fullTicket.submitterName,
        replyAuthor: input.admin.name,
        replyBody: input.body,
        appUrl,
      }),
    }).catch(() => {});

    return comment;
  });
}
