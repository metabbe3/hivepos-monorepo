import {
  withErrorHandler,
  parseBody,
  apiSuccess,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { expenseCategorySchema } from "@/lib/validations";
import {
  updateExpenseCategoryService,
  deleteExpenseCategoryService,
} from "@/modules/expenses/expenses.module";
import type { UpdateCategoryInput } from "@/modules/expenses/application/dto";

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("expenses", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, expenseCategorySchema.partial());

  const category = await updateExpenseCategoryService.execute(
    id,
    input as UpdateCategoryInput,
    permission,
  );

  return apiSuccess(category);
});

export const DELETE = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("expenses", "delete");
  const { id } = await ctx!.params;

  await deleteExpenseCategoryService.execute(id, permission);

  return apiSuccess({ deleted: true });
});
