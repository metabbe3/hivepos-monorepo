import { NextResponse } from "next/server";
import {
  withErrorHandler,
  NotFoundError,
  type RouteContext,
} from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { readPhotoBytes } from "@/lib/photo-storage";

// GET /api/track/[orderNumber]/photos/[photoId] — public binary serve for the
// customer tracking page. Same access model as the list route: orderNumber is
// the capability; the photo must belong to that order + tenant and still be
// within its 7-day TTL. All failures collapse to 404 so a photo's existence
// isn't leakable. Mirrors the authed serve at
// app/api/orders/[id]/photos/[photoId]/route.ts.
export const GET = withErrorHandler<unknown>(
  async (req, ctx?: RouteContext<Record<string, string>>) => {
    rateLimit(req, { limit: 60, windowSeconds: 60 });
    const { orderNumber, photoId } = await ctx!.params;
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

    const photo = await prisma.orderPhoto.findUnique({
      where: { id: photoId },
      select: {
        storagePath: true,
        mime: true,
        tenantId: true,
        orderId: true,
        expiresAt: true,
      },
    });
    if (
      !photo ||
      photo.tenantId !== order.branch.tenantId ||
      photo.orderId !== order.id
    ) {
      throw new NotFoundError("Photo not found");
    }
    // Honor the TTL on read (lazy enforcement before the cron sweeps).
    if (photo.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundError("Photo not found");
    }

    const bytes = await readPhotoBytes(photo.storagePath);
    // Binary response — `as never` satisfies withErrorHandler's
    // SuccessEnvelope<T> signature (mirrors the authed serve route).
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": photo.mime,
        // Private — never a shared/CDN cache (tenant-scoped bytes).
        "Cache-Control": "private, max-age=3600",
      },
    }) as never;
  },
);
