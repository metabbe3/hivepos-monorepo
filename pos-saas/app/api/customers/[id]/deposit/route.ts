import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { depositTopUpSchema } from "@/lib/validations";
import {
  topUpDepositService,
  listDepositTransactionsService,
} from "@/modules/customers/customers.module";

export const GET = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("customers", "read");
  const { id } = await ctx!.params;

  const transactions = await listDepositTransactionsService.execute(
    id,
    permission,
  );

  return apiSuccess(transactions);
});

export const POST = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("deposits", "create");
  const { id } = await ctx!.params;
  const parsed = await parseBody(req, depositTopUpSchema);

  const transaction = await topUpDepositService.execute(
    id,
    { amount: parsed.amount, description: parsed.description },
    permission,
  );

  return apiCreated(transaction);
});
