import { withErrorHandler, parseBody, apiSuccess, apiCreated } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { branchSchema } from "@/lib/validations";
import { listBranchesService, createBranchService } from "@/modules/branches/branches.module";

export const GET = withErrorHandler(async () => {
  const ctx = await requirePermissionOrThrow("branches", "read");
  const branches = await listBranchesService.execute(ctx);
  return apiSuccess(branches);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requirePermissionOrThrow("branches", "create");
  const input = await parseBody(req, branchSchema);
  const branch = await createBranchService.execute(input, ctx);
  return apiCreated(branch);
});
