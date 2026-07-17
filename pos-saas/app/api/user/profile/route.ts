import bcrypt from "bcrypt";
import { withErrorHandler, parseBody, apiSuccess, UnauthenticatedError, NotFoundError, ValidationError } from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { profileUpdateSchema } from "@/lib/validations";

const BCRYPT_ROUNDS = 12;

async function getSessionOrThrow() {
  const session = await getApiSession();
  if (!session) throw new UnauthenticatedError();
  return session;
}

export const GET = withErrorHandler(async () => {
  const session = await getSessionOrThrow();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, googleId: true, avatar: true },
  });

  if (!user) throw new NotFoundError("User", session.user.id);

  return apiSuccess(user);
});

export const PATCH = withErrorHandler(async (req) => {
  const session = await getSessionOrThrow();
  const data = await parseBody(req, profileUpdateSchema);

  // If changing password, verify current password
  if (data.newPassword && data.currentPassword) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { passwordHash: true },
    });
    if (!user) throw new NotFoundError("User", session.user.id);

    const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
    if (!valid) {
      throw new ValidationError("Kata sandi lama salah.");
    }
  }

  // Build update data
  const updateData: { name?: string; phone?: string | null; passwordHash?: string } = {};
  if (data.name) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.newPassword) {
    updateData.passwordHash = await bcrypt.hash(data.newPassword, BCRYPT_ROUNDS);
  }

  if (Object.keys(updateData).length === 0) {
    throw new ValidationError("Tidak ada perubahan.");
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: updateData,
    select: { id: true, name: true, email: true, phone: true, role: true },
  });

  return apiSuccess(updated);
});
