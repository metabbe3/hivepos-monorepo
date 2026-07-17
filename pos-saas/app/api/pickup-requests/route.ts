import { z } from "zod/v4";
import { withErrorHandler, apiSuccess, apiCreated, parseBody, ValidationError } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";
import { listPickupsService, createPickupService } from "@/modules/pickup-requests/pickup-requests.module";
import type { ListPickupRequestsInput } from "@/modules/pickup-requests/application/dto";

/** GET /api/pickup-requests — list pickups for the caller's branches. */
export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("pickupRequests", "read");

  const { searchParams } = new URL(req.url);
  const input: ListPickupRequestsInput = {};
  for (const key of ["status", "search", "page", "limit"]) {
    const val = searchParams.get(key);
    if (val) (input as Record<string, string>)[key] = val;
  }

  const result = await listPickupsService.execute(input, ctx);

  return apiSuccess(result.items, {
    total: result.total,
    page: result.page,
    totalPages: result.totalPages,
  });
});

/**
 * POST /api/pickup-requests — staff creates a pickup on behalf of an existing
 * customer. Reuses createPickupService so validation/normalization matches
 * the public form; we just supply the branch slug + customer snapshot.
 *
 * ponytail: addressText is required for staff too — the underlying service
 * rejects no-location pickups, and a driver needs somewhere to go. Staff
 * without a precise address can type "akan konfirmasi via WhatsApp".
 */
const staffCreateSchema = z.object({
  customerId: z.string().min(1, "Pelanggan wajib dipilih."),
  branchId: z.string().min(1, "Outlet wajib dipilih."),
  addressText: z.string().min(4, "Alamat wajib diisi."),
  requestedDate: z.string().optional().or(z.literal("")),
  requestedSlot: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const POST = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("pickupRequests", "create");

  const raw = await parseBody(req, staffCreateSchema);

  // Branch must belong to caller's tenant AND be in caller's branch scope.
  if (!ctx.branchIds.includes(raw.branchId)) {
    throw new ValidationError("Outlet ini bukan milik akun Anda.");
  }
  const branch = await prisma.branch.findFirst({
    where: { id: raw.branchId, tenantId: ctx.tenantId, isActive: true },
    select: { id: true, slug: true },
  });
  if (!branch || !branch.slug) {
    throw new ValidationError("Outlet tidak ditemukan atau pickup belum diaktifkan.");
  }

  // Customer must belong to the same tenant (via branch.tenantId).
  const customer = await prisma.customer.findFirst({
    where: { id: raw.customerId, branch: { tenantId: ctx.tenantId } },
    select: { id: true, name: true, phone: true, email: true },
  });
  if (!customer) {
    throw new ValidationError("Pelanggan tidak ditemukan.");
  }
  if (!customer.phone) {
    throw new ValidationError("Nomor telepon pelanggan belum terdaftar.");
  }

  const pickup = await createPickupService.execute({
    branchSlug: branch.slug,
    customerName: customer.name,
    customerPhone: customer.phone,
    customerEmail: customer.email || undefined,
    addressText: raw.addressText,
    requestedDate: raw.requestedDate || undefined,
    requestedSlot: raw.requestedSlot || undefined,
    notes: raw.notes || undefined,
  });

  // Attach customerId to the created pickup (service doesn't set it from public form).
  await prisma.pickupRequest.update({
    where: { id: pickup.id },
    data: { customerId: customer.id },
  });

  return apiCreated({ id: pickup.id });
});
