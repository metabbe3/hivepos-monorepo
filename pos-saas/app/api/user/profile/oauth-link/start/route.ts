import {
  withErrorHandler,
  apiSuccess,
  UnauthenticatedError,
  NotFoundError,
  ConflictError,
} from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import { signLinkToken, LINK_COOKIE } from "@/lib/auth";

// 5 minutes — long enough to complete Google OAuth, short enough to limit
// replay window if the user abandons the flow mid-way.
const LINK_COOKIE_MAX_AGE = 300;

export const POST = withErrorHandler(async () => {
  const session = await getApiSession();
  if (!session) throw new UnauthenticatedError();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, googleId: true },
  });
  if (!user) throw new NotFoundError("User", session.user.id);
  if (user.googleId) {
    throw new ConflictError("Google account is already linked");
  }

  const token = signLinkToken(user.id);
  const res = apiSuccess({ ok: true });
  res.headers.set(
    "Set-Cookie",
    `${LINK_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Max-Age=${LINK_COOKIE_MAX_AGE}; Path=/`,
  );
  return res;
});
