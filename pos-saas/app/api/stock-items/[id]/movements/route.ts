import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { stockMovementSchema } from "@/lib/validations";
import {
  recordMovementService,
  listMovementsService,
} from "@/modules/inventory/inventory.module";
import type { CreateMovementInput } from "@/modules/inventory/application/dto";

export const GET = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("inventory", "read");
  const { id } = await ctx!.params;

  const movements = await listMovementsService.execute(id, permission);

  return apiSuccess(movements);
});

export const POST = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("inventory", "create");
  const { id } = await ctx!.params;
  const input = await parseBody(req, stockMovementSchema);

  const movement = await recordMovementService.execute(
    id,
    input as CreateMovementInput,
    permission,
  );

  return apiCreated(movement);
});
