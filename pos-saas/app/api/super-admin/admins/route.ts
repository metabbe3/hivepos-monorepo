import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
  ConflictError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";
import { hashPassword } from "@/modules/shared/application/password";

// GET — list all super admins
export const GET = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow();

  const admins = await prisma.superAdmin.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      sessionVersion: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return apiSuccess({
    admins: admins.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      updatedAt: a.updatedAt.toISOString(),
    })),
    currentAdminId: session.user.id,
  });
});

// POST — create a new super admin (SUPER_ADMIN only)
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json().catch(() => ({}));

  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new ValidationError("Valid email is required");
  }

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name || name.length < 2) {
    throw new ValidationError("Name must be at least 2 characters");
  }

  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters");
  }

  const role = body?.role === "SUPPORT" ? "SUPPORT" : "SUPER_ADMIN";

  const existing = await prisma.superAdmin.findUnique({ where: { email } });
  if (existing) throw new ConflictError("Email already in use");

  const passwordHash = await hashPassword(password);

  const created = await prisma.$transaction(async (tx) => {
    const admin = await tx.superAdmin.create({
      data: { email, name, passwordHash, role },
    });
    await auditLog(tx, {
      actor,
      action: "admin.create",
      target: { type: "SuperAdmin", id: admin.id },
      diff: { email, name, role },
      req,
    });
    return admin;
  });

  return apiSuccess({ admin: { id: created.id, email: created.email } });
});
