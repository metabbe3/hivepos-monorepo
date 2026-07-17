import {
  withErrorHandler,
  parseBody,
  apiSuccess,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { stockItemSchema } from "@/lib/validations";
import {
  updateStockItemService,
  deleteStockItemService,
} from "@/modules/inventory/inventory.module";
import type { UpdateStockItemInput } from "@/modules/inventory/application/dto";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("inventory", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, stockItemSchema.partial());

  const item = await updateStockItemService.execute(
    id,
    input as UpdateStockItemInput,
    permission,
  );

  return apiSuccess(item);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("inventory", "delete");
  const { id } = await ctx!.params;

  await deleteStockItemService.execute(id, permission);

  return apiSuccess({ deleted: true });
});
