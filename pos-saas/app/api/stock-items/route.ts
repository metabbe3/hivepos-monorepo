import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { stockItemSchema } from "@/lib/validations";
import {
  listStockItemsService,
  createStockItemService,
} from "@/modules/inventory/inventory.module";
import type { CreateStockItemInput } from "@/modules/inventory/application/dto";

export const GET = withErrorHandler(async () => {
  const ctx = await requireWithBranchOrThrow("inventory", "read");

  const items = await listStockItemsService.execute(ctx);

  return apiSuccess(items);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("inventory", "create");
  const input = await parseBody(req, stockItemSchema);

  const item = await createStockItemService.execute(
    input as CreateStockItemInput,
    ctx,
  );

  return apiCreated(item);
});
