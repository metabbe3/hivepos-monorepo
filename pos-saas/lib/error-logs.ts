import { prisma } from "@/lib/prisma";
import { logger } from "@/modules/shared/logging/logger";
import { auditLog, type AuditActor } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/modules/shared";

/**
 * Fire-and-forget persistence of a 5xx error. MUST NOT throw — called from
 * withErrorHandler's catch path where any new exception would mask the original
 * error and could turn a recoverable 500 into an unhandled rejection on an
 * unrelated endpoint.
 *
 * Caller does NOT await. Internal `.catch(logger.warn)` swallows Prisma pool
 * exhaustion / unique-violation / connection drops.
 */
export function persistErrorLog(input: {
  requestId: string;
  method: string;
  url: string;
  httpStatus: number;
  code: string;
  message: string;
  stack?: string | null;
  tenantId?: string | null;
  userId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}): void {
  prisma.errorLog
    .create({
      data: {
        requestId: input.requestId,
        method: input.method,
        url: input.url,
        httpStatus: input.httpStatus,
        code: input.code,
        message: input.message,
        stack: input.stack ?? null,
        tenantId: input.tenantId ?? null,
        userId: input.userId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    })
    .catch((err) => {
      logger.warn(
        { err, requestId: input.requestId, code: input.code },
        "errorlog.persist_failed",
      );
    });
}

export type ErrorLogFilters = {
  code?: string;
  tenantId?: string;
  resolved?: boolean;
  httpStatusMin?: number;
  httpStatusMax?: number;
  from?: Date;
  to?: Date;
  page: number;
  pageSize: number;
};

export async function getErrorLogs(filters: ErrorLogFilters) {
  const where = {
    ...(filters.code && { code: filters.code }),
    ...(filters.tenantId && { tenantId: filters.tenantId }),
    ...(filters.resolved !== undefined && { resolved: filters.resolved }),
    ...((filters.httpStatusMin || filters.httpStatusMax) && {
      httpStatus: {
        ...(filters.httpStatusMin && { gte: filters.httpStatusMin }),
        ...(filters.httpStatusMax && { lte: filters.httpStatusMax }),
      },
    }),
    ...((filters.from || filters.to) && {
      createdAt: {
        ...(filters.from && { gte: filters.from }),
        ...(filters.to && { lte: filters.to }),
      },
    }),
  };

  // ponytail: take +1 to detect "has next page" — mirrors lib/audit-query.ts.
  const rows = await prisma.errorLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize + 1,
  });

  const hasNext = rows.length > filters.pageSize;
  return {
    rows: rows.slice(0, filters.pageSize).map((r) => ({
      id: r.id,
      requestId: r.requestId,
      method: r.method,
      url: r.url,
      httpStatus: r.httpStatus,
      code: r.code,
      message: r.message,
      stack: r.stack,
      tenantId: r.tenantId,
      userId: r.userId,
      ipAddress: r.ipAddress,
      resolved: r.resolved,
      createdAt: r.createdAt.toISOString(),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasNext,
  };
}

export async function setErrorLogResolved(
  errorLogId: string,
  resolved: boolean,
  actor: AuditActor,
  req: Request | null,
  reason: string | null,
) {
  const current = await prisma.errorLog.findUnique({
    where: { id: errorLogId },
    select: { id: true, resolved: true, tenantId: true },
  });
  if (!current) throw new NotFoundError("ErrorLog", errorLogId);
  if (current.resolved === resolved) {
    throw new ConflictError(
      `ErrorLog is already ${resolved ? "resolved" : "unresolved"}`,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.errorLog.update({
      where: { id: errorLogId },
      data: { resolved },
    });
    await auditLog(tx, {
      actor,
      action: "errorlog.resolve",
      target: { type: "ErrorLog", id: errorLogId, tenantId: current.tenantId },
      reason,
      diff: { resolved: { from: current.resolved, to: resolved } },
      req,
    });
  });
}
