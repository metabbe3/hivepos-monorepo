import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/shared/application/password";
import { auditLog, type AuditActor } from "@/lib/audit";
import { NotFoundError, ConflictError } from "@/modules/shared";

/**
 * Cross-tenant platform user admin.
 *
 * Mirrors Phase 2 tenant suspend semantics:
 *   - isActive=false blocks login at lib/auth.ts:128
 *   - sessionVersion++ invalidates any active JWT
 *
 * resetPassword returns a plaintext temp password the admin hands to the
 * user out-of-band. No email integration exists in the codebase.
 */

export type PlatformUserFilters = {
  q?: string; // matches email OR name (case-insensitive)
  tenantId?: string;
  isActive?: boolean;
  page: number;
  pageSize: number;
};

export async function getPlatformUsers(filters: PlatformUserFilters) {
  // ponytail: Postgres ILIKE for case-insensitive search across email OR name.
  const q = filters.q?.trim() || undefined;
  const where = {
    ...(filters.tenantId && { tenantId: filters.tenantId }),
    ...(filters.isActive !== undefined && { isActive: filters.isActive }),
    ...(q && {
      OR: [{ email: { contains: q, mode: "insensitive" as const } }, { name: { contains: q, mode: "insensitive" as const } }],
    }),
  };

  // take +1 to detect next page, like Phase 6 audit-query.
  const rows = await prisma.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (filters.page - 1) * filters.pageSize,
    take: filters.pageSize + 1,
    include: {
      tenant: { select: { id: true, name: true, slug: true } },
      branch: { select: { name: true } },
    },
  });

  const hasNext = rows.length > filters.pageSize;

  return {
    rows: rows.slice(0, filters.pageSize).map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      isActive: u.isActive,
      tenantId: u.tenantId,
      tenantName: u.tenant.name,
      tenantSlug: u.tenant.slug,
      branchName: u.branch?.name ?? null,
      createdAt: u.createdAt.toISOString(),
    })),
    page: filters.page,
    pageSize: filters.pageSize,
    hasNext,
  };
}

export async function suspendUser(
  userId: string,
  actor: AuditActor,
  reason: string,
  req: Request | null,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, tenantId: true, email: true, name: true },
  });
  if (!user) throw new NotFoundError("User", userId);
  if (!user.isActive) throw new ConflictError("User is already suspended");

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: false, sessionVersion: { increment: 1 } },
    });
    await auditLog(tx, {
      actor,
      action: "user.suspend",
      target: { type: "User", id: userId, tenantId: user.tenantId },
      reason,
      diff: { isActive: { from: true, to: false } },
      req,
    });
  });
}

export async function reactivateUser(
  userId: string,
  actor: AuditActor,
  reason: string | null,
  req: Request | null,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, tenantId: true, tenant: { select: { isActive: true } } },
  });
  if (!user) throw new NotFoundError("User", userId);
  if (user.isActive) throw new ConflictError("User is already active");
  if (!user.tenant.isActive) {
    throw new ConflictError("Cannot reactivate user: tenant is suspended");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { isActive: true },
    });
    await auditLog(tx, {
      actor,
      action: "user.reactivate",
      target: { type: "User", id: userId, tenantId: user.tenantId },
      reason,
      diff: { isActive: { from: false, to: true } },
      req,
    });
  });
}

const TEMP_PASSWORD_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const TEMP_PASSWORD_LEN = 12;

function generateTempPassword(): string {
  // ponytail: crypto.randomInt — uniform over the alphabet, no special chars (admin hand-types it).
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LEN; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

export async function resetUserPassword(
  userId: string,
  actor: AuditActor,
  reason: string,
  req: Request | null,
): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, tenantId: true, email: true, googleId: true },
  });
  if (!user) throw new NotFoundError("User", userId);
  if (user.googleId && !user.email) {
    throw new ConflictError("User has no password (Google-only account)");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    await auditLog(tx, {
      actor,
      action: "user.reset_password",
      target: { type: "User", id: userId, tenantId: user.tenantId },
      reason,
      // ponytail: do NOT include the temp password in the audit trail.
      diff: { passwordChanged: true, sessionInvalidated: true },
      req,
    });
  });

  return tempPassword;
}
