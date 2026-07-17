import {
  withErrorHandler,
  parseBody,
  apiSuccess,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { serviceSchema } from "@/lib/validations";
import {
  updateServiceService,
  deleteServiceService,
} from "@/modules/services/services.module";
import type { UpdateServiceInput } from "@/modules/services/application/dto";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("services", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, serviceSchema.partial());

  const service = await updateServiceService.execute(
    id,
    input as UpdateServiceInput,
    permission,
  );

  return apiSuccess(service);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("services", "delete");
  const { id } = await ctx!.params;

  await deleteServiceService.execute(id, permission);

  return apiSuccess({ deleted: true });
});
