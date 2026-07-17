import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { toCSV, csvResponse, csvHandler } from "@/lib/csv";

// GET — CSV export of audit log entries. SUPER_ADMIN or SUPPORT.
export const GET = csvHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow();
  const actor = { id: session.user.id!, email: session.user.email! };

  const url = new URL(req.url);
  const sp = url.searchParams;

  const targetType = sp.get("targetType") || undefined;
  const actorEmail = sp.get("actorEmail") || undefined;
  const actionPrefix = sp.get("actionPrefix") || undefined;
  const from = sp.get("from");
  const to = sp.get("to");

  const where = {
    ...(targetType && { targetType }),
    ...(actorEmail && { actorEmail: { contains: actorEmail } }),
    ...(actionPrefix && { action: { startsWith: actionPrefix } }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    }),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  const csv = toCSV(
    ["ID", "Created At", "Action", "Actor ID", "Actor Email", "Target Type", "Target ID", "Tenant ID", "Reason", "IP Address", "Diff (JSON)"],
    rows.map((r) => [
      r.id,
      r.createdAt.toISOString(),
      r.action,
      r.actorId ?? "",
      r.actorEmail ?? "",
      r.targetType,
      r.targetId,
      r.tenantId ?? "",
      r.reason ?? "",
      r.ipAddress ?? "",
      r.diff ? JSON.stringify(r.diff) : "",
    ]),
  );

  await auditLog(prisma, {
    actor,
    action: "audit_log.export",
    target: { type: "AuditLog", id: "export" },
    diff: { rowCount: rows.length, filters: { targetType, actorEmail, actionPrefix, from, to } },
    req,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return csvResponse(`audit-log-${stamp}.csv`, csv);
});
