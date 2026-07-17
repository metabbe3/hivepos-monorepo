import { prisma } from "@/lib/prisma";

export type AuditLogFilters = {
  targetType?: string;
  actionPrefix?: string;
  actorEmail?: string; // substring match (case-sensitive — Postgres default)
  from?: Date;
  to?: Date;
  page: number; // 1-based
  pageSize: number; // default 50, max 100
};

export async function getAuditLogs(filters: AuditLogFilters) {
  const where = {
    ...(filters.targetType && { targetType: filters.targetType }),
    ...(filters.actorEmail && { actorEmail: { contains: filters.actorEmail } }),
    ...(filters.actionPrefix && { action: { startsWith: filters.actionPrefix } }),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      },
    }),
  };

  // ponytail: take +1 to detect "has next page" — avoids a separate COUNT query.
  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize + 1,
  });

  const hasNext = rows.length > filters.pageSize;

  return {
    rows: rows.slice(0, filters.pageSize).map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.targetType,
      targetId: r.targetId,
      tenantId: r.tenantId,
      actorId: r.actorId,
      actorEmail: r.actorEmail,
      reason: r.reason,
      diff: r.diff,
      ipAddress: r.ipAddress,
      createdAt: r.createdAt.toISOString(),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasNext,
  };
}
