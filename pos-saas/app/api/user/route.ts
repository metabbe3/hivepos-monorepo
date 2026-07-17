import { withErrorHandler, apiSuccess, UnauthenticatedError } from "@/modules/shared";
import { getApiSession } from "@/lib/get-session";

export const GET = withErrorHandler(async () => {
  const session = await getApiSession();
  if (!session) {
    throw new UnauthenticatedError("Session required");
  }

  return apiSuccess({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    role: session.user.role,
    branchId: session.user.branchId,
    tenantId: session.user.tenantId,
  });
});
