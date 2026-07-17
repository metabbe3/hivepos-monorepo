import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { serviceSchema } from "@/lib/validations";
import {
  listServicesService,
  createServiceService,
} from "@/modules/services/services.module";
import type { CreateServiceInput } from "@/modules/services/application/dto";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("services", "read");

  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const services = await listServicesService.execute({ includeInactive }, ctx);

  return apiSuccess(services);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("services", "create");
  const input = await parseBody(req, serviceSchema);

  const service = await createServiceService.execute(
    input as CreateServiceInput,
    ctx,
  );

  return apiCreated(service);
});
