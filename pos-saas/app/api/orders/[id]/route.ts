import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  type RouteContext,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { orderNotesUpdateSchema, orderSchema } from "@/lib/validations";
import {
  getOrderService,
  updateNotesService,
  updateOrderService,
  deleteOrderService,
} from "@/modules/orders/orders.module";
import type { UpdateOrderInput, UpdateNotesInput } from "@/modules/orders/application/dto";

export const GET = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("orders", "read");
  const { id } = await ctx!.params;

  const order = await getOrderService.execute(id, permission);

  return apiSuccess(order);
});

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("orders", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, orderNotesUpdateSchema);

  const order = await updateNotesService.execute(
    id,
    input as UpdateNotesInput,
    permission,
  );

  return apiSuccess(order);
});

export const PUT = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("orders", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, orderSchema);

  const order = await updateOrderService.execute(
    id,
    input as UpdateOrderInput,
    permission,
  );

  return apiSuccess(order);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("orders", "delete");
  const { id } = await ctx!.params;

  await deleteOrderService.execute(id, permission);

  return apiSuccess({ deleted: true });
});
