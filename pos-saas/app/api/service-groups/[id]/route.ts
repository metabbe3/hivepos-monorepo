import {
  withErrorHandler,
  parseBody,
  apiSuccess,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { serviceGroupSchema } from "@/lib/validations";
import {
  updateServiceGroupService,
  deleteServiceGroupService,
} from "@/modules/services/services.module";
import type { UpdateGroupInput } from "@/modules/services/application/dto";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("services", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, serviceGroupSchema.partial());

  const group = await updateServiceGroupService.execute(
    id,
    input as UpdateGroupInput,
    permission,
  );

  return apiSuccess(group);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("services", "delete");
  const { id } = await ctx!.params;

  await deleteServiceGroupService.execute(id, permission);

  return apiSuccess({ deleted: true });
});
