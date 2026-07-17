import { withErrorHandler, parseBody, apiSuccess, apiCreated } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { roleCreateSchema } from "@/lib/validations";
import { listRolesService, createRoleService } from "@/modules/roles/roles.module";

export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("roles", "read");
  const roles = await listRolesService.execute(ctx);
  return apiSuccess(roles);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requirePermissionOrThrow("roles", "create");
  const input = await parseBody(req, roleCreateSchema);
  const role = await createRoleService.execute(
    {
      name: input.name,
      description: input.description ?? null,
      color: input.color,
      permissions: input.permissions,
    },
    ctx,
  );
  return apiCreated(role);
});
