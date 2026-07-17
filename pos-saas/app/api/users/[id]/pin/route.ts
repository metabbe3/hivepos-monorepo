import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import { withErrorHandler, apiSuccess, ValidationError } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { pinField } from "@/lib/validations";
import { z } from "zod";

const schema = z
  .object({
    pin: pinField.optional(),
    rotateQr: z.boolean().optional(),
  })
  .refine((d) => d.pin !== undefined || d.rotateQr, { message: "pin or rotateQr required" });

// Owner/Manager sets a staff's clock PIN and/or generates a fresh QR token.
export const PATCH = withErrorHandler(async (req, ctx) => {
  const admin = await requirePermissionOrThrow("attendance", "edit");
  const { id } = await ctx!.params;
  const parsed = schema.parse(await req.json());

  const target = await prisma.user.findFirst({
    where: { id, tenantId: admin.tenantId },
    select: { id: true },
  });
  if (!target) throw new ValidationError("Staff not found");

  const data: { pinHash?: string; qrToken?: string | null } = {};
  if (parsed.pin !== undefined) data.pinHash = await bcrypt.hash(parsed.pin, 10);
  if (parsed.rotateQr) data.qrToken = randomBytes(9).toString("base64url");

  await prisma.user.update({ where: { id }, data });
  return apiSuccess({ ok: true, qrToken: parsed.rotateQr ? data.qrToken : undefined });
});
