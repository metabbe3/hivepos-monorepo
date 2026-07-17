import {
  withErrorHandler,
  parseBody,
  apiSuccess,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { customerSchema } from "@/lib/validations";
import {
  getCustomerService,
  updateCustomerService,
  deleteCustomerService,
} from "@/modules/customers/customers.module";
import type { UpdateCustomerInput } from "@/modules/customers/application/dto";

export const GET = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("customers", "read");
  const { id } = await ctx!.params;

  const { searchParams } = new URL(req.url);
  const dateRange = {
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  };

  const customer = await getCustomerService.execute(id, dateRange, permission);

  return apiSuccess(customer);
});

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("customers", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, customerSchema.partial());

  const customer = await updateCustomerService.execute(
    id,
    input as UpdateCustomerInput,
    permission,
  );

  return apiSuccess(customer);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("customers", "delete");
  const { id } = await ctx!.params;

  await deleteCustomerService.execute(id, permission);

  return apiSuccess({ deleted: true });
});
