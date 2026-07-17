import type { PrismaClient } from "@/app/generated/prisma/client";

/**
 * Audit log writer. Call inside a `prisma.$transaction` to keep the log row
 * atomic with the mutation it describes:
 *
 *   await prisma.$transaction(async (tx) => {
 *     await tx.tenant.update({ ... });
 *     await auditLog(tx, { actor, action: "tenant.suspend", target: { type: "Tenant", id, tenantId }, reason, req });
 *   });
 *
 * `actor` is the SuperAdmin session.user. `req` is the Next.js Request (used to
 * capture IP + UA); pass undefined outside an HTTP context.
 */

type Tx = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export type AuditTarget = {
  type: string; // "Tenant" | "SaaSPayment" | "SuperAdmin" | ...
  id: string;
  tenantId?: string | null;
};

export type AuditActor = {
  id: string;
  email: string;
};

export type AuditLogInput = {
  actor: AuditActor;
  action: string; // dotted: "tenant.suspend", "billing.refund"
  target: AuditTarget;
  reason?: string | null;
  diff?: Record<string, unknown> | null;
  req?: Request | null;
};

export async function auditLog(tx: Tx, input: AuditLogInput) {
  const ipAddress = input.req ? extractIp(input.req) : null;
  const userAgent = input.req?.headers.get("user-agent") ?? null;

  return tx.auditLog.create({
    data: {
      action: input.action,
      targetType: input.target.type,
      targetId: input.target.id,
      tenantId: input.target.tenantId ?? null,
      actorId: input.actor.id,
      actorEmail: input.actor.email,
      reason: input.reason ?? null,
      diff: (input.diff ?? undefined) as any,
      ipAddress,
      userAgent,
    },
  });
}

function extractIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip");
}
