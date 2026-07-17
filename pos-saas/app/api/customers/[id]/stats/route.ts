import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { customerStatsService } from "@/modules/customers/customers.module";

export const GET = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("customers", "read");
  const { id } = await ctx!.params;

  const { searchParams } = new URL(req.url);
  const dateRange = {
    from: searchParams.get("from") || undefined,
    to: searchParams.get("to") || undefined,
  };

  const stats = await customerStatsService.execute(id, dateRange, permission);

  return apiSuccess(stats);
});
