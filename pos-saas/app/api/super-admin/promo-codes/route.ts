import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
  ConflictError,
  NotFoundError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

// GET — list all promo codes
export const GET = withErrorHandler(async () => {
  await assertSuperAdminOrThrow("SUPER_ADMIN");

  const codes = await prisma.promoCode.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { redemptions: true } },
    },
  });

  return apiSuccess({
    promoCodes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: Number(c.value),
      maxRedemptions: c.maxRedemptions,
      redemptionCount: c.redemptionCount,
      validFrom: c.validFrom?.toISOString() ?? null,
      validUntil: c.validUntil?.toISOString() ?? null,
      isActive: c.isActive,
      applicablePlan: c.applicablePlan,
      createdAt: c.createdAt.toISOString(),
    })),
  });
});

// POST — create a new promo code
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json();

  // ── Validate required fields ──
  const code = (body?.code as string | undefined)?.trim().toUpperCase();
  if (!code) {
    throw new ValidationError("Kode wajib diisi.");
  }

  const type = body?.type as string | undefined;
  if (!["FREE_MONTH", "DISCOUNT_PERCENT", "DISCOUNT_FIXED"].includes(type ?? "")) {
    throw new ValidationError("Jenis promo tidak valid.");
  }

  const value = Number(body?.value);
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError("Nilai harus lebih dari 0.");
  }
  if (type === "DISCOUNT_PERCENT" && value > 100) {
    throw new ValidationError("Diskon persen maksimal 100.");
  }

  const maxRedemptions =
    body?.maxRedemptions === null || body?.maxRedemptions === undefined || body?.maxRedemptions === ""
      ? null
      : Math.max(0, Math.floor(Number(body.maxRedemptions)));
  if (maxRedemptions !== null && (!Number.isFinite(maxRedemptions) || maxRedemptions < 0)) {
    throw new ValidationError("Jumlah redempsi tidak boleh negatif.");
  }

  // Plan restriction: null = applies to any plan tier.
  const applicablePlan =
    body?.applicablePlan === "GROWTH" || body?.applicablePlan === "PRO"
      ? body.applicablePlan
      : null;

  // ── Parse optional validity window ──
  let validFrom: Date | null = null;
  let validUntil: Date | null = null;
  if (body?.validFrom) {
    const d = new Date(body.validFrom);
    if (!isNaN(d.getTime())) validFrom = d;
  }
  if (body?.validUntil) {
    const d = new Date(body.validUntil);
    if (!isNaN(d.getTime())) validUntil = d;
  }

  // ── Enforce code uniqueness ──
  const existing = await prisma.promoCode.findUnique({ where: { code } });
  if (existing) {
    throw new ConflictError("Kode sudah dipakai.");
  }

  const created = await prisma.$transaction(async (tx) => {
    const promoCode = await tx.promoCode.create({
      data: {
        code,
        description: (body?.description as string | undefined)?.trim() || null,
        type: type as "FREE_MONTH" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED",
        value,
        maxRedemptions,
        validFrom,
        validUntil,
        applicablePlan,
        isActive: body?.isActive !== false,
      },
    });
    await auditLog(tx, {
      actor,
      action: "promoCode.create",
      target: { type: "PromoCode", id: promoCode.id },
      diff: { code, type, value, maxRedemptions, applicablePlan },
      req,
    });
    return promoCode;
  });

  return apiSuccess({
    promoCode: {
      id: created.id,
      code: created.code,
      type: created.type,
      value: Number(created.value),
    },
  });
});

// PATCH — toggle active state (deactivate / reactivate)
export const PATCH = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json();
  const id = body?.id as string | undefined;
  if (!id) {
    throw new ValidationError("ID wajib diisi.");
  }

  const newIsActive = Boolean(body?.isActive);
  const existing = await prisma.promoCode.findUnique({
    where: { id },
    select: { isActive: true },
  });
  if (!existing) throw new NotFoundError("PromoCode", id);

  const updated = await prisma.$transaction(async (tx) => {
    const promoCode = await tx.promoCode.update({
      where: { id },
      data: { isActive: newIsActive },
      select: { id: true, code: true, isActive: true },
    });
    await auditLog(tx, {
      actor,
      action: "promoCode.toggle",
      target: { type: "PromoCode", id },
      diff: { before: { isActive: existing.isActive }, after: { isActive: newIsActive } },
      req,
    });
    return promoCode;
  });

  return apiSuccess({ promoCode: updated });
});

// PUT — edit an existing promo code (type/value/plan/validity/active). Today only
// PATCH-toggle exists; full editing is part of "all promo functions work".
export const PUT = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };

  const body = await req.json();
  const id = body?.id as string | undefined;
  if (!id) throw new ValidationError("ID wajib diisi.");

  const existing = await prisma.promoCode.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("PromoCode", id);

  const data: Record<string, unknown> = {};
  if (typeof body?.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (body?.type && ["FREE_MONTH", "DISCOUNT_PERCENT", "DISCOUNT_FIXED"].includes(body.type)) {
    data.type = body.type;
  }
  if (body?.value !== undefined) {
    const v = Number(body.value);
    if (!Number.isFinite(v) || v <= 0) throw new ValidationError("Nilai harus lebih dari 0.");
    const effectiveType = (data.type as string | undefined) ?? existing.type;
    if (effectiveType === "DISCOUNT_PERCENT" && v > 100) {
      throw new ValidationError("Diskon persen maksimal 100.");
    }
    data.value = v;
  }
  if (body?.maxRedemptions !== undefined && body?.maxRedemptions !== "") {
    data.maxRedemptions =
      body.maxRedemptions === null ? null : Math.max(0, Math.floor(Number(body.maxRedemptions)));
  }
  if (body?.validUntil !== undefined) {
    const d = body.validUntil ? new Date(body.validUntil) : null;
    data.validUntil = d && !isNaN(d.getTime()) ? d : null;
  }
  if (body?.applicablePlan !== undefined) {
    data.applicablePlan =
      body.applicablePlan === "GROWTH" || body.applicablePlan === "PRO"
        ? body.applicablePlan
        : null;
  }
  if (typeof body?.isActive === "boolean") data.isActive = body.isActive;

  const updated = await prisma.$transaction(async (tx) => {
    const promoCode = await tx.promoCode.update({ where: { id }, data });
    await auditLog(tx, {
      actor,
      action: "promoCode.update",
      target: { type: "PromoCode", id },
      diff: data,
      req,
    });
    return promoCode;
  });

  return apiSuccess({ promoCode: { id: updated.id, code: updated.code } });
});
