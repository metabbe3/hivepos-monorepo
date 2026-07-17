import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
  ValidationError,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { expenseSchema } from "@/lib/validations";
import {
  listExpensesService,
  createExpenseService,
} from "@/modules/expenses/expenses.module";
import type {
  CreateExpenseInput,
  ListExpensesInput,
} from "@/modules/expenses/application/dto";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("expenses", "read");

  const { searchParams } = new URL(req.url);
  const input: ListExpensesInput = {
    categoryId: searchParams.get("categoryId") || undefined,
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  };

  const expenses = await listExpensesService.execute(input, ctx);

  return apiSuccess(expenses);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("expenses", "create");
  // "Semua Outlet" (ALL) has no single branch — creating an expense would write
  // branchId="ALL" → FK violation. Force a specific outlet selection.
  // (Matches the orders route guard; UI also hides "Semua Outlet" on this page.)
  if (ctx.branchId === "ALL") {
    throw new ValidationError("Pilih outlet spesifik sebelum mencatat pengeluaran.");
  }
  const input = await parseBody(req, expenseSchema);

  const expense = await createExpenseService.execute(
    input as CreateExpenseInput,
    ctx,
  );

  return apiCreated(expense);
});
