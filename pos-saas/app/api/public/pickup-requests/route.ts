import { z } from "zod/v4";
import { withErrorHandler, apiCreated, parseBody } from "@/modules/shared";
import { createPickupService } from "@/modules/pickup-requests/pickup-requests.module";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Public pickup request submission — NO AUTH.
 *
 * Customer provides their name, phone, optional location, and scheduling
 * preferences. We resolve the branch by slug, validate, and persist with
 * status=PENDING for staff review.
 */
const pickupRequestSchema = z.object({
  branchSlug: z.string().min(1, "Outlet wajib dipilih."),
  customerName: z.string().min(1, "Nama wajib diisi."),
  customerPhone: z.string().min(1, "Nomor telepon wajib diisi."),
  customerEmail: z.string().optional().or(z.literal("")),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  addressText: z.string().optional().or(z.literal("")),
  requestedDate: z.string().optional().or(z.literal("")),
  requestedSlot: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

export const POST = withErrorHandler(async (req) => {
  rateLimit(req, { limit: 10, windowSeconds: 60 });

  const raw = await parseBody(req, pickupRequestSchema);

  const pickup = await createPickupService.execute({
    branchSlug: raw.branchSlug,
    customerName: raw.customerName,
    customerPhone: raw.customerPhone,
    customerEmail: raw.customerEmail || undefined,
    latitude: raw.latitude,
    longitude: raw.longitude,
    addressText: raw.addressText || undefined,
    requestedDate: raw.requestedDate || undefined,
    requestedSlot: raw.requestedSlot || undefined,
    notes: raw.notes || undefined,
  });

  return apiCreated({ id: pickup.id });
});
