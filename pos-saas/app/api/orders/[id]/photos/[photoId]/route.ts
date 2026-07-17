import { NextResponse } from "next/server";
import { withErrorHandler, apiSuccess, NotFoundError } from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { readPhotoBytes, deletePhoto } from "@/lib/photo-storage";

// GET /api/orders/[id]/photos/[photoId] — stream the compressed bytes.
// Auth-gated + tenant-scoped: photos are NEVER served from /public (multi-tenant
// privacy). Cross-tenant, path-mismatch, and expired all collapse to 404 so the
// existence of another tenant's photo isn't leakable.
export const GET = withErrorHandler(async (_req, ctx) => {
  const { id, photoId } = await ctx!.params;
  const perm = await requirePermissionOrThrow("orders", "read");

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
  if (!photo || photo.tenantId !== perm.tenantId || photo.orderId !== id) {
    throw new NotFoundError("OrderPhoto", photoId);
  }
  // Honor the TTL on read too (lazy enforcement before the cron sweeps).
  if (photo.expiresAt.getTime() <= Date.now()) {
    throw new NotFoundError("OrderPhoto", photoId);
  }

  const bytes = await readPhotoBytes(photo.storagePath);
  // Binary response — `as never` satisfies withErrorHandler's SuccessEnvelope<T>
  // signature (mirrors app/api/reports/export/route.ts). The wrapper returns the
  // handler's result unchanged, so the raw image bytes pass straight through.
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": photo.mime,
      // Private — never a shared/CDN cache (tenant-scoped bytes).
      "Cache-Control": "private, max-age=3600",
    },
  }) as never;
});

// DELETE /api/orders/[id]/photos/[photoId] — remove file + row.
export const DELETE = withErrorHandler(async (_req, ctx) => {
  const { id, photoId } = await ctx!.params;
  const perm = await requirePermissionOrThrow("orders", "delete");

  const photo = await prisma.orderPhoto.findUnique({
    where: { id: photoId },
    select: { storagePath: true, tenantId: true, orderId: true },
  });
  if (!photo || photo.tenantId !== perm.tenantId || photo.orderId !== id) {
    throw new NotFoundError("OrderPhoto", photoId);
  }

  await deletePhoto(photo.storagePath);
  await prisma.orderPhoto.delete({ where: { id: photoId } });

  return apiSuccess({ deleted: true });
});
