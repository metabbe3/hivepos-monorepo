import { withErrorHandler, parseBody, apiSuccess, apiCreated, ValidationError } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { orderSchema } from "@/lib/validations";
import {
  createOrderService,
  listOrdersService,
  orderRepo,
} from "@/modules/orders/orders.module";
import type { CreateOrderInput, ListOrdersInput } from "@/modules/orders/application/dto";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("orders", "read");

  const { searchParams } = new URL(req.url);
  const input: ListOrdersInput = {};
  for (const key of [
    "status",
    "search",
    "page",
    "limit",
    "sortBy",
    "sortOrder",
    "paymentStatus",
    "dateFrom",
    "dateTo",
  ]) {
    const val = searchParams.get(key);
    if (val) (input as Record<string, string>)[key] = val;
  }

  const result = await listOrdersService.execute(input, ctx);

  return apiSuccess(result.orders, {
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  });
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("orders", "create");

  // "Semua Outlet" (ALL) has no single branch — creating an order would write
  // branchId="ALL" → FK violation → 500. Force a specific outlet selection.
  if (ctx.branchId === "ALL") {
    throw new ValidationError("Pilih outlet spesifik sebelum membuat order.");
  }

  // ponytail: idempotency short-circuit. When X-Client-Id is present (offline
  // sync, double-submit guard), return the previously-created order instead
  // of creating a duplicate. Skips body parsing on hit — small win.
  const clientId = req.headers.get("x-client-id") || undefined;
  if (clientId) {
    const existing = await orderRepo.findByClientId(clientId);
    if (existing) return apiSuccess(existing);
  }

  const input = await parseBody(req, orderSchema);

  // ponytail: when X-Client-Id is present the request came from the offline
  // sync path — IDB is client-controlled and tamperable. Clamp receivedAt to
  // the current calendar day so a tampered payload can't backdate an order
  // into an old reporting period. Fail-open to "now" rather than rejecting:
  // sync shouldn't deadlock on clock skew, and the worst case is the order
  // lands with today's timestamp. Online path (no X-Client-Id) is unchanged
  // so the existing custom-time feature for catch-up entries still works.
  if (clientId && input.receivedAt) {
    const parsed = new Date(input.receivedAt);
    const now = new Date();
    const sameDay =
      parsed.getUTCFullYear() === now.getUTCFullYear() &&
      parsed.getUTCMonth() === now.getUTCMonth() &&
      parsed.getUTCDate() === now.getUTCDate();
    if (!sameDay) {
      input.receivedAt = now.toISOString();
    }
  }

  const order = await createOrderService.execute(
    { ...(input as CreateOrderInput), clientId },
    ctx,
  );

  return apiCreated(order);
});
