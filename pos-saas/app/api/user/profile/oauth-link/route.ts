import {
  withErrorHandler,
  apiSuccess,
  UnauthenticatedError,
  NotFoundError,
  ConflictError,
} from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";

export const DELETE = withErrorHandler(async () => {
  const session = await getApiSession();
  if (!session) throw new UnauthenticatedError();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, googleId: true, passwordHash: true },
  });
  if (!user) throw new NotFoundError("User", session.user.id);
  if (!user.googleId) {
    throw new ConflictError("No Google account linked");
  }
  // ponytail: schema marks passwordHash non-optional, so every user can
  // still log in via credentials after unlink. If we ever add OAuth-only
  // signups, this needs a password-set gate before allowing unlink.
  if (!user.passwordHash) {
    throw new ConflictError(
      "Cannot unlink Google without a password set on the account",
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { googleId: null, avatar: null },
  });

  return apiSuccess({ ok: true });
});
