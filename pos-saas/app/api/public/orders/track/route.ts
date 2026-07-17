import { prisma } from "@/lib/prisma";
import { withErrorHandler, apiSuccess, ValidationError } from "@/modules/shared";
import { rateLimit } from "@/lib/rate-limit";

// Public "find my orders by phone" — tenant-scoped via the x-tenant-slug header
// (set by middleware on subdomain requests). Rejects on the apex domain so it
// can NEVER search across tenants. Rate-limited.
export const GET = withErrorHandler(async (req: Request) => {
  rateLimit(req, { limit: 10, windowSeconds: 60 });

  const tenantSlug = req.headers.get("x-tenant-slug");
  if (!tenantSlug) {
    throw new ValidationError("Tenant required");
  }

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone");
  if (!phone) {
    throw new ValidationError("Phone number required");
  }

  const orders = await prisma.order.findMany({
    where: {
      customer: { phone: { contains: phone.replace(/[^0-9]/g, "") } },
      branch: { tenant: { slug: tenantSlug } },
    },
    select: {
      orderNumber: true,
      status: true,
      totalAmount: true,
      createdAt: true,
      customer: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return apiSuccess(
    orders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      createdAt: o.createdAt.toISOString(),
      customerName: o.customer.name,
    })),
  );
});
