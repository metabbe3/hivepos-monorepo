import { withErrorHandler, parseBody, apiSuccess } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { branchSchema } from "@/lib/validations";
import { getBranchService, updateBranchService } from "@/modules/branches/branches.module";

export const GET = withErrorHandler(async (_req, ctx) => {
  const permission = await requirePermissionOrThrow("branches", "read");
  const { id } = await ctx!.params;
  const branch = await getBranchService.execute(id, permission);
  return apiSuccess(branch);
});

export const PATCH = withErrorHandler(async (req, ctx) => {
  const permission = await requirePermissionOrThrow("branches", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, branchSchema.partial());
  const branch = await updateBranchService.execute(id, input, permission);
  return apiSuccess(branch);
});
