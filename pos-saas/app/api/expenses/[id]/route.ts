import {
  withErrorHandler,
  parseBody,
  apiSuccess,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { expenseSchema } from "@/lib/validations";
import {
  updateExpenseService,
  deleteExpenseService,
} from "@/modules/expenses/expenses.module";
import type { UpdateExpenseInput } from "@/modules/expenses/application/dto";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("expenses", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, expenseSchema.partial());

  const expense = await updateExpenseService.execute(
    id,
    input as UpdateExpenseInput,
    permission,
  );

  return apiSuccess(expense);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("expenses", "delete");
  const { id } = await ctx!.params;

  await deleteExpenseService.execute(id, permission);

  return apiSuccess({ deleted: true });
});
