import { prisma } from "@/lib/prisma";
import { deletePhoto } from "@/lib/photo-storage";

/**
 * Delete order photos whose TTL has expired. Clones the telemetry purge pattern
 * (lib/telemetry.ts purgeTelemetryBefore) but also unlinks the file on disk.
 *
 * Called two ways:
 *  - lazily, tenant-scoped, on every upload (keeps active tenants clean with no
 *    cron dependency);
 *  - globally by the daily /api/internal/photo-cleanup endpoint (sweeps idle
 *    tenants too).
 *
 * Returns the number of rows purged.
 */
export async function purgeExpiredPhotos(
  opts: { tenantId?: string; now?: Date } = {},
): Promise<number> {
  const now = opts.now ?? new Date();
  const expired = await prisma.orderPhoto.findMany({
    where: {
      expiresAt: { lt: now },
      ...(opts.tenantId ? { tenantId: opts.tenantId } : {}),
    },
    select: { id: true, storagePath: true },
  });
  if (expired.length === 0) return 0;

  // ponytail: unlink each file best-effort (a missing file must not block the
  // row delete), then delete rows in one batch.
  await Promise.all(
    expired.map((p) => deletePhoto(p.storagePath).catch(() => {})),
  );
  const r = await prisma.orderPhoto.deleteMany({
    where: { id: { in: expired.map((p) => p.id) } },
  });
  return r.count;
}
