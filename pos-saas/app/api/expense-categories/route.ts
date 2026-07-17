import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { expenseCategorySchema } from "@/lib/validations";
import {
  listExpenseCategoriesService,
  createExpenseCategoryService,
} from "@/modules/expenses/expenses.module";
import type { CreateCategoryInput } from "@/modules/expenses/application/dto";

export const GET = withErrorHandler(async () => {
  const ctx = await requireWithBranchOrThrow("expenses", "read");

  const categories = await listExpenseCategoriesService.execute(ctx);

  return apiSuccess(categories);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("expenses", "create");
  const input = await parseBody(req, expenseCategorySchema);

  const category = await createExpenseCategoryService.execute(
    input as CreateCategoryInput,
    ctx,
  );

  return apiCreated(category);
});
