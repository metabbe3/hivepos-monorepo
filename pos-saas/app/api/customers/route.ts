import {
  withErrorHandler,
  parseBody,
  apiSuccess,
  apiCreated,
  type RouteContext,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { customerSchema } from "@/lib/validations";
import { listCustomersService, createCustomerService, customerRepo } from "@/modules/customers/customers.module";
import type { CreateCustomerInput } from "@/modules/customers/application/dto";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("customers", "read");

  const { searchParams } = new URL(req.url);
  const input = {
    search: searchParams.get("search") || undefined,
    sort: (searchParams.get("sort") as any) || undefined,
    order: (searchParams.get("order") as any) || undefined,
    status: (searchParams.get("status") as any) || "",
  };

  const customers = await listCustomersService.execute(input, ctx);

  return apiSuccess(customers);
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("customers", "create");

  // ponytail: idempotency short-circuit for offline-created walk-in customers.
  // Order of dedup matters: clientId first (same device re-submitting), then
  // phone (two devices both offline creating same customer). Both return the
  // existing record instead of throwing, so the sync pipeline is idempotent.
  // We serialize Date → ISO here so the response shape matches the create path.
  const clientId = req.headers.get("x-client-id") || undefined;
  if (clientId) {
    const existingByClientId = await customerRepo.findByClientId(clientId);
    if (existingByClientId) {
      return apiSuccess({
        ...existingByClientId,
        createdAt: existingByClientId.createdAt.toISOString(),
        updatedAt: existingByClientId.updatedAt.toISOString(),
      });
    }
  }

  const input = await parseBody(req, customerSchema);

  if (clientId && input.phone && input.phone.trim()) {
    const existingByPhone = await customerRepo.findByPhone(input.phone, ctx.branchId);
    if (existingByPhone) {
      return apiSuccess({
        ...existingByPhone,
        createdAt: existingByPhone.createdAt.toISOString(),
        updatedAt: existingByPhone.updatedAt.toISOString(),
      });
    }
  }

  const customer = await createCustomerService.execute(
    { ...(input as CreateCustomerInput), clientId },
    ctx,
  );

  return apiCreated(customer);
});
