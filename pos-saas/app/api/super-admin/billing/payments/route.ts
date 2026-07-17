import { withErrorHandler, apiSuccess, ValidationError } from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { getPaymentLedger } from "@/lib/billing-analytics";

const VALID_STATUSES = ["PENDING", "PAID", "FAILED", "REFUNDED"] as const;

export const GET = withErrorHandler(async (req: Request) => {
  await assertSuperAdminOrThrow();
  const url = new URL(req.url);
  const sp = url.searchParams;

  const status = sp.get("status");
  if (status && !(VALID_STATUSES as readonly string[]).includes(status)) {
    throw new ValidationError(`Invalid status: ${status}`);
  }

  const from = sp.get("from");
  const to = sp.get("to");
  const tenantId = sp.get("tenantId") || undefined;

  const page = Math.max(1, Number(sp.get("page") ?? "1"));
  // ponytail: clamp pageSize instead of throwing — friendlier on the URL.
  const pageSize = Math.min(Math.max(1, Number(sp.get("pageSize") ?? "20")), 100);

  const result = await getPaymentLedger({
    ...(status && { status: status as (typeof VALID_STATUSES)[number] }),
    ...(from && { from: new Date(from) }),
    ...(to && { to: new Date(to) }),
    ...(tenantId && { tenantId }),
    page,
    pageSize,
  });

  return apiSuccess(result);
});
