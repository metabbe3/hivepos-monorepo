import { withErrorHandler, parseBody, apiSuccess } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { userUpdateSchema } from "@/lib/validations";
import { updateUserService, deleteUserService } from "@/modules/users/users.module";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requirePermissionOrThrow("users", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, userUpdateSchema);
  const user = await updateUserService.execute(id, input, permission);
  return apiSuccess(user);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requirePermissionOrThrow("users", "delete");
  const { id } = await ctx!.params;
  await deleteUserService.execute(id, permission);
  return apiSuccess({ deleted: true });
});
