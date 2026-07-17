import { withErrorHandler, parseBody, apiSuccess, apiCreated } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { userCreateSchema } from "@/lib/validations";
import { listUsersService, createUserService } from "@/modules/users/users.module";

export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("users", "read");
  const users = await listUsersService.execute(ctx);
  return apiSuccess(users);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requirePermissionOrThrow("users", "create");
  const input = await parseBody(req, userCreateSchema);
  const user = await createUserService.execute(
    { ...input, phone: input.phone ?? null },
    ctx,
  );
  return apiCreated(user);
});
