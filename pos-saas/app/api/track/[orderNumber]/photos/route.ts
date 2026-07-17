import {
  withErrorHandler,
  apiSuccess,
  NotFoundError,
  type RouteContext,
} from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// GET /api/track/[orderNumber]/photos — public proof-photo list for the
// customer tracking page (NO AUTH; orderNumber is the capability, same trust
// model as /api/track/[orderNumber]). Tenant-scoped via the x-tenant-slug
// header middleware injects on subdomain requests. Only non-expired photos are
// returned — expired rows are gone (or about to be) so they never appear here.
export const GET = withErrorHandler<unknown>(
  async (req, ctx?: RouteContext<Record<string, string>>) => {
    rateLimit(req, { limit: 30, windowSeconds: 60 });
    const { orderNumber } = await ctx!.params;
    const tenantSlug = req.headers.get("x-tenant-slug");

    const order = await prisma.order.findUnique({
      where: { orderNumber },
      select: {
        id: true,
        branch: {
          select: { tenantId: true, tenant: { select: { slug: true } } },
        },
      },
    });
    if (!order) throw new NotFoundError("Order not found");
    if (tenantSlug && order.branch.tenant.slug !== tenantSlug) {
      throw new NotFoundError("Order not found");
    }

    const photos = await prisma.orderPhoto.findMany({
      where: {
        orderId: order.id,
        tenantId: order.branch.tenantId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        kind: true,
        bytes: true,
        width: true,
        height: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    return apiSuccess(
      photos.map((p) => ({
        id: p.id,
        kind: p.kind,
        bytes: p.bytes,
        width: p.width,
        height: p.height,
        createdAt: p.createdAt.toISOString(),
        expiresAt: p.expiresAt.toISOString(),
      })),
    );
  },
);
