import { withErrorHandler, apiSuccess, NotFoundError, type RouteContext } from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "@/lib/constants";

// ponytail: tenant-scoped tracking. x-tenant-slug header is set by middleware
// on subdomain requests; absent on root-domain. When present, order must
// belong to that tenant — prevents cross-tenant order enumeration. Root
// domain resolves any order (still useful for owner-side debugging and
// short-URL prints). Ceiling: per-request DB hit, no cache — order detail
// changes frequently so caching adds little.
export const GET = withErrorHandler<unknown>(async (req, ctx?: RouteContext<Record<string, string>>) => {
  const { orderNumber } = await ctx!.params;
  const tenantSlug = req.headers.get("x-tenant-slug");

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: {
      orderNumber: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
      discountAmount: true,
      paidAmount: true,
      notes: true,
      createdAt: true,
      receivedAt: true,
      inProgressAt: true,
      readyAt: true,
      deliveredAt: true,
      customer: { select: { name: true, phone: true } },
      orderItems: {
        select: {
          quantity: true,
          weightKg: true,
          pricePerUnit: true,
          subtotal: true,
          garmentBreakdown: true,
          service: { select: { name: true, pricingType: true } },
        },
      },
      payments: {
        select: {
          amount: true,
          paymentMethod: true,
          paidAt: true,
        },
        orderBy: { paidAt: "desc" },
      },
      branch: {
        select: {
          name: true,
          phone: true,
          whatsappLink: true,
          address: true,
          latitude: true,
          longitude: true,
          invoiceFooter: true,
          tenant: { select: { slug: true, settings: true } },
        },
      },
    },
  });

  if (!order) {
    throw new NotFoundError("Order not found");
  }

  // Tenant scoping: if the request came via a subdomain, the order's tenant
  // must match. Mismatch → 404 (don't leak that the order exists elsewhere).
  if (tenantSlug && order.branch.tenant.slug !== tenantSlug) {
    throw new NotFoundError("Order not found");
  }

  // ponytail: pull QRIS from tenant settings.website.qrisImageUrl if set.
  // Untyped JSON access — Prisma's JSON column is `unknown` at the type level.
  const settings = order.branch.tenant.settings as
    | { website?: { qrisImageUrl?: string }; whatsappTemplates?: Record<string, string> }
    | null;
  const qrisImageUrl = settings?.website?.qrisImageUrl || null;
  const whatsappTemplates = settings?.whatsappTemplates ?? null;

  return apiSuccess({
    orderNumber: order.orderNumber,
    status: order.status,
    statusLabel: ORDER_STATUS_CONFIG[order.status]?.labelKey ?? order.status,
    paymentStatus: order.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_CONFIG[order.paymentStatus]?.labelKey ?? order.paymentStatus,
    customerName: order.customer.name,
    customerPhone: order.customer.phone,
    totalAmount: Number(order.totalAmount),
    discountAmount: Number(order.discountAmount),
    paidAmount: Number(order.paidAmount),
    notes: order.notes,
    createdAt: order.createdAt.toISOString(),
    receivedAt: order.receivedAt?.toISOString() ?? null,
    inProgressAt: order.inProgressAt?.toISOString() ?? null,
    readyAt: order.readyAt?.toISOString() ?? null,
    deliveredAt: order.deliveredAt?.toISOString() ?? null,
    items: order.orderItems.map((item) => ({
      service: item.service.name,
      pricingType: item.service.pricingType,
      quantity: Number(item.quantity),
      weightKg: item.weightKg ? Number(item.weightKg) : null,
      pricePerUnit: Number(item.pricePerUnit),
      subtotal: Number(item.subtotal),
      garmentBreakdown: (item.garmentBreakdown as { name: string; qty: number }[] | null) ?? null,
    })),
    payments: order.payments.map((p) => ({
      amount: Number(p.amount),
      method: p.paymentMethod,
      paidAt: p.paidAt.toISOString(),
    })),
    branch: {
      name: order.branch.name,
      phone: order.branch.phone,
      whatsappLink: order.branch.whatsappLink,
      address: order.branch.address,
      latitude: order.branch.latitude,
      longitude: order.branch.longitude,
      invoiceFooter: order.branch.invoiceFooter,
    },
    qrisImageUrl,
    whatsappTemplates,
  });
});
