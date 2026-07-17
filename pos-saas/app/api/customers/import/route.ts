import { withErrorHandler, apiSuccess, ValidationError } from "@/modules/shared";
import { prisma } from "@/lib/prisma";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { customerSchema } from "@/lib/validations";

const MAX_ROWS = 1000;

type ImportRow = {
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("customers", "create");

  const body = await req.json();
  const rawRows: unknown[] = Array.isArray(body?.rows) ? body.rows : [];
  if (rawRows.length === 0) throw new ValidationError("Tidak ada baris untuk diimpor.");
  if (rawRows.length > MAX_ROWS) {
    throw new ValidationError(`Maksimal ${MAX_ROWS} baris per impor (diterima ${rawRows.length}).`);
  }

  // ponytail: ALL-outlets import lands in the first active branch. Multi-outlet
  // owners should pick a specific outlet first. Upgrade: a branch picker.
  const targetBranchId = ctx.isAllOutlets ? ctx.branchIds[0] : ctx.branchId;
  if (!targetBranchId || targetBranchId === "__NO_BRANCHES__") {
    throw new ValidationError("Tidak ada outlet aktif untuk tujuan impor.");
  }

  // Validate per-row (skip invalid, collect errors). Dedup by phone within the
  // batch; NULL-phone rows always pass through (they can't collide on the
  // @@unique([branchId, phone]) index).
  const valid: ImportRow[] = [];
  const errors: { row: number; reason: string }[] = [];
  const seenPhones = new Set<string>();
  let skipped = 0;

  rawRows.forEach((raw, i) => {
    const parsed = customerSchema.safeParse(raw);
    if (!parsed.success) {
      errors.push({ row: i + 1, reason: parsed.error.issues[0]?.message ?? "invalid" });
      return;
    }
    const phone = parsed.data.phone?.trim() || null;
    if (phone && seenPhones.has(phone)) { skipped++; return; }
    if (phone) seenPhones.add(phone);
    valid.push({
      name: parsed.data.name.trim(),
      phone,
      email: parsed.data.email?.trim() || null,
      notes: parsed.data.notes?.trim() || null,
    });
  });

  // Existing phones in the target branch — one query, no N+1.
  const phones = [...seenPhones];
  const existing = phones.length
    ? await prisma.customer.findMany({
        where: { branchId: targetBranchId, phone: { in: phones } },
        select: { phone: true },
      })
    : [];
  const existingPhones = new Set(existing.map((c) => c.phone));

  const toCreate = valid.filter((v) => !v.phone || !existingPhones.has(v.phone));
  skipped += valid.length - toCreate.length;

  let imported = 0;
  if (toCreate.length > 0) {
    // ponytail: single createMany — Customer has no tenantId column (tenant is
    // reached via branch), so branchId is the only scope key. No client input
    // reaches the create; targetBranchId comes from the session guard.
    await prisma.customer.createMany({
      data: toCreate.map((c) => ({ ...c, branchId: targetBranchId })),
    });
    imported = toCreate.length;
  }

  return apiSuccess({ imported, skipped, errors });
});
