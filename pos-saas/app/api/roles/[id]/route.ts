import { withErrorHandler, parseBody, apiSuccess } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { roleUpdateSchema } from "@/lib/validations";
import {
  getRoleService,
  updateRoleService,
  deleteRoleService,
} from "@/modules/roles/roles.module";

export const GET = withErrorHandler(async (_req, ctx) => {
  const permission = await requirePermissionOrThrow("roles", "read");
  const { id } = await ctx!.params;
  const role = await getRoleService.execute(id, permission);
  return apiSuccess(role);
});

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requirePermissionOrThrow("roles", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, roleUpdateSchema);
  const role = await updateRoleService.execute(id, input, permission);
  return apiSuccess(role);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requirePermissionOrThrow("roles", "delete");
  const { id } = await ctx!.params;
  await deleteRoleService.execute(id, permission);
  return apiSuccess({ deleted: true });
});
