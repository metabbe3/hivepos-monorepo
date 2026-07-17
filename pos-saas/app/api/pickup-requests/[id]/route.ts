import { withErrorHandler, apiSuccess, type RouteContext } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { getPickupService } from "@/modules/pickup-requests/pickup-requests.module";
import { prisma } from "@/lib/prisma";

/** GET /api/pickup-requests/[id] — detail. */
export const GET = withErrorHandler(async (_req, ctx) => {
  const permission = await requireWithBranchOrThrow("pickupRequests", "read");
  const { id } = await ctx!.params;

  const pickup = await getPickupService.execute(id, permission);

  // ponytail: inline lookup for the linked Order — display-first delivery leg.
  // Avoids extending the DTO/repo/mapper triplet for one read-only field.
  // If we later add more Order fields, promote to a port in the pickup module.
  let convertedOrderSummary: {
    id: string;
    orderNumber: string;
    status: string;
    deliveredAt: Date | null;
  } | null = null;
  if (pickup.convertedOrderId) {
    const order = await prisma.order.findFirst({
      where: { id: pickup.convertedOrderId, branch: { tenantId: permission.tenantId } },
      select: { id: true, orderNumber: true, status: true, deliveredAt: true },
    });
    if (order) convertedOrderSummary = order;
  }

  return apiSuccess({ ...pickup, convertedOrderSummary });
});
