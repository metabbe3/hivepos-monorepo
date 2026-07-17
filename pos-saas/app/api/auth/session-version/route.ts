import { getApiSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  UnauthenticatedError,
  NotFoundError,
} from "@/modules/shared";

/**
 * GET /api/auth/session-version
 *
 * Returns the caller's current server-side sessionVersion.
 * Used by the client-side poller (useSessionSync) to detect when
 * permissions have been updated and the JWT needs to be refreshed.
 */
export const GET = withErrorHandler(async () => {
  // getApiSession() (bearer-aware) so mobile/Flutter clients can poll this
  // with their token; falls back to the cookie path for the web client.
  const session = await getApiSession();
  if (!session?.user?.id) {
    throw new UnauthenticatedError();
  }

  // Super admin doesn't have a User row
  if (session.user.role === "SUPER_ADMIN") {
    return apiSuccess({ sessionVersion: 0 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { sessionVersion: true },
  });

  if (!user) {
    throw new NotFoundError("User", session.user.id);
  }

  return apiSuccess({ sessionVersion: user.sessionVersion });
});
