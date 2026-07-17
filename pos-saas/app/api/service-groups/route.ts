import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import {
  serviceGroupSchema,
  serviceGroupReorderSchema,
} from "@/lib/validations";
import {
  listServiceGroupsService,
  createServiceGroupService,
  reorderServiceGroupsService,
} from "@/modules/services/services.module";
import type {
  CreateGroupInput,
  ReorderGroupsInput,
} from "@/modules/services/application/dto";

export const GET = withErrorHandler(async () => {
  const ctx = await requireWithBranchOrThrow("services", "read");

  const groups = await listServiceGroupsService.execute(ctx);

  return apiSuccess(groups);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("services", "create");
  const input = await parseBody(req, serviceGroupSchema);

  const group = await createServiceGroupService.execute(
    input as CreateGroupInput,
    ctx,
  );

  return apiCreated(group);
});

export const PATCH = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("services", "edit");
  const input = await parseBody(req, serviceGroupReorderSchema);

  await reorderServiceGroupsService.execute(
    input as ReorderGroupsInput,
    ctx,
  );

  return apiSuccess({ reordered: true });
});
