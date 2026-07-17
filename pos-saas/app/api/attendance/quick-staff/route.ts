import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { withErrorHandler, apiCreated, ValidationError } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/modules/shared/application/password";
import { pinField } from "@/lib/validations";
import { z } from "zod";

// Quick-add an attendance-only staff (no email/login). Email + password are
// synthesized so the User model's required fields stay satisfied without the
// owner typing them. The staff clocks via PIN; they can never log in (fake
// email, random password, no reset path).

const schema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().optional(),
  pin: pinField,
  branchId: z.string().optional(),
});

const slug = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "staff";

export const POST = withErrorHandler(async (req) => {
  const ctx = await requirePermissionOrThrow("attendance", "edit");
  const parsed = schema.parse(await req.json());

  const staffRole = await prisma.role.findFirst({
    where: { tenantId: ctx.tenantId, name: "Staff" },
    select: { id: true },
  });

  const email = `${slug(parsed.name)}-${randomBytes(3).toString("hex")}@no-login.local`;
  const passwordHash = await hashPassword(randomBytes(12).toString("base64url"));
  const pinHash = await bcrypt.hash(parsed.pin, 10);

  const user = await prisma.user.create({
    data: {
      email,
      name: parsed.name,
      phone: parsed.phone || null,
      passwordHash,
      pinHash,
      role: "EMPLOYEE",
      roleId: staffRole?.id ?? null,
      branchId: parsed.branchId || null,
      tenantId: ctx.tenantId,
      isActive: true,
    },
    select: { id: true, name: true },
  });
  return apiCreated(user);
});
