import {
  withErrorHandler,
  apiSuccess,
  apiCreated,
  NotFoundError,
  ValidationError,
  ForbiddenError,
  UnauthenticatedError,
} from "@/modules/shared";
import { requirePermissionOrThrow } from "@/lib/permissions/check";
import { getApiSession } from "@/lib/get-session";
import { hasFeatureFlag } from "@/lib/require-feature-flag";
import { getTenantPlan } from "@/lib/billing";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "node:crypto";
import { compressPhoto } from "@/lib/photo-process";
import { savePhotoBytes } from "@/lib/photo-storage";
import { purgeExpiredPhotos } from "@/lib/photo-cleanup";
import { PHOTO_TTL_DAYS } from "@/lib/constants";

const ALLOWED_KINDS = new Set(["before", "after", "damage"]);
const MAX_RAW_BYTES = 15_000_000; // 15 MB raw — sharp shrinks it ~10–50×.

const PHOTO_SELECT = {
  id: true,
  kind: true,
  bytes: true,
  width: true,
  height: true,
  mime: true,
  createdAt: true,
  expiresAt: true,
} as const;

// POST /api/orders/[id]/photos — upload a compressed before/after/damage photo.
export const POST = withErrorHandler(async (req, ctx) => {
  const { id } = await ctx!.params;

  // Feature flag: default-enabled; allow unless explicitly disabled for the
  // tenant (hasFeatureFlag is permissive on an unknown flag, so sessions that
  // predate the flag aren't locked out).
  const session = await getApiSession();
  if (!session) throw new UnauthenticatedError();
  if (!hasFeatureFlag("orderPhotos", session)) {
    throw new ForbiddenError("Feature not available");
  }

  const perm = await requirePermissionOrThrow("orders", "edit");

  // Pro-only feature: order proof photos require an active Pro plan (or a Pro
  // trial). The orderPhotos flag stays as a super-admin kill-switch on top.
  const plan = await getTenantPlan(perm.tenantId);
  if (plan !== "PRO") {
    throw new ForbiddenError("Foto bukti pesanan adalah fitur Pro.");
  }

  // Verify the order belongs to this tenant (order → branch → tenantId).
  const order = await prisma.order.findFirst({
    where: { id, branch: { tenantId: perm.tenantId } },
    select: { id: true, orderNumber: true, branchId: true },
  });
  if (!order) throw new NotFoundError("Order", id);

  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const file = form.get("file");
  if (!ALLOWED_KINDS.has(kind)) {
    throw new ValidationError("kind must be one of: before, after, damage");
  }
  if (!(file instanceof File)) throw new ValidationError("file is required");
  if (!file.type.startsWith("image/")) {
    throw new ValidationError("file must be an image");
  }
  if (file.size > MAX_RAW_BYTES) {
    throw new ValidationError("image too large (max 15 MB)");
  }

  const raw = Buffer.from(await file.arrayBuffer());

  // Decode/resize/encode via sharp. A corrupt or non-image file (MIME is
  // client-supplied, so a bad file can slip past the type check above) makes
  // sharp throw — catch it and return a friendly 400 instead of a 500.
  let compressed;
  try {
    compressed = await compressPhoto(raw);
  } catch {
    throw new ValidationError(
      "Tidak bisa memproses gambar. Coba foto ulang atau pakai file gambar lain (JPG/PNG).",
    );
  }

  // Unique + traceable path: {tenantId}/{orderNumber}/{kind}-{stamp}-{rand}.webp
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 14);
  const storagePath = `${perm.tenantId}/${order.orderNumber}/${kind}-${stamp}-${randomUUID().slice(0, 8)}.webp`;

  await savePhotoBytes(storagePath, compressed.buffer);

  const photo = await prisma.orderPhoto.create({
    data: {
      tenantId: perm.tenantId,
      orderId: order.id,
      branchId: order.branchId,
      kind,
      storagePath,
      bytes: compressed.buffer.length,
      width: compressed.width,
      height: compressed.height,
      mime: compressed.mime,
      expiresAt: new Date(now.getTime() + PHOTO_TTL_DAYS * 86_400_000),
    },
    select: PHOTO_SELECT,
  });

  // Lazy tenant-scoped purge: keep this tenant's expired photos gone without
  // depending on the daily cron. Best-effort — never block the upload response.
  void purgeExpiredPhotos({ tenantId: perm.tenantId }).catch(() => {});

  return apiCreated(photo);
});

// GET /api/orders/[id]/photos — list photos + the effective gate so the client
// can render the gallery vs. an upgrade nudge in one call. `enabled` =
// orderPhotos flag on AND an active Pro plan.
export const GET = withErrorHandler(async (_req, ctx) => {
  const { id } = await ctx!.params;
  const session = await getApiSession();
  if (!session) throw new UnauthenticatedError();
  const perm = await requirePermissionOrThrow("orders", "read");

  const photos = await prisma.orderPhoto.findMany({
    where: { orderId: id, tenantId: perm.tenantId },
    orderBy: { createdAt: "asc" },
    select: PHOTO_SELECT,
  });

  const plan = await getTenantPlan(perm.tenantId);
  const enabled = hasFeatureFlag("orderPhotos", session) && plan === "PRO";
  return apiSuccess({ photos, enabled, plan });
});
