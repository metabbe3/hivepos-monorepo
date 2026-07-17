import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { hashPassword, verifyPassword } from "@/modules/shared/application/password";

// POST — change own password. Verifies current password, bumps sessionVersion
// so any other sessions (different device) are forced to re-authenticate.
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow();
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json().catch(() => ({}));
  const current = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const next = typeof body?.newPassword === "string" ? body.newPassword : "";

  if (current.length === 0) throw new ValidationError("Kata sandi lama wajib diisi.");
  if (next.length < 8) throw new ValidationError("Kata sandi baru minimal 8 karakter.");

  const admin = await prisma.superAdmin.findUnique({
    where: { id: actor.id },
    select: { passwordHash: true, sessionVersion: true },
  });
  if (!admin) throw new ValidationError("Akun tidak ditemukan.");

  const ok = await verifyPassword(current, admin.passwordHash);
  if (!ok) throw new ValidationError("Kata sandi lama salah.");

  const newHash = await hashPassword(next);

  await prisma.$transaction(async (tx) => {
    await tx.superAdmin.update({
      where: { id: actor.id },
      data: {
        passwordHash: newHash,
        sessionVersion: { increment: 1 },
      },
    });
    await auditLog(tx, {
      actor,
      action: "admin.change_password",
      target: { type: "SuperAdmin", id: actor.id },
      req,
    });
  });

  return apiSuccess({ ok: true });
});
