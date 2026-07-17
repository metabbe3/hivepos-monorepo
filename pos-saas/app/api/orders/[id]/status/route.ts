import {
  withErrorHandler,
  parseBody,
  apiSuccess,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { statusUpdateSchema } from "@/lib/validations";
import { advanceStatusService } from "@/modules/orders/orders.module";
import type { AdvanceStatusInput } from "@/modules/orders/application/dto";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("orders", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, statusUpdateSchema);

  const order = await advanceStatusService.execute(
    id,
    input as AdvanceStatusInput,
    permission,
  );

  return apiSuccess(order);
});
