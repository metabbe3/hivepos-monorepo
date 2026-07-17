import { ValidationError } from "@/modules/shared";
import type {
  PickupRequestRepository,
  BranchPort,
  CreatePickupRequestData,
} from "../domain/repository.port";
import type { BusinessModule } from "../domain/types";
import type { CreatePickupRequestInput } from "./dto";
import type { PickupRequest } from "../domain/types";

/**
 * Public submission endpoint — no auth.
 *
 * Resolves the branch by slug, normalizes the phone number, derives the
 * maps link from lat/lng, and persists the request with status=PENDING.
 */
export class CreatePickupRequestService {
  constructor(
    private pickupRepo: PickupRequestRepository,
    private branchPort: BranchPort,
  ) {}

  async execute(input: CreatePickupRequestInput): Promise<PickupRequest> {
    // ── 1. Resolve branch by slug ──
    if (!input.branchSlug) {
      throw new ValidationError("Outlet wajib dipilih.");
    }
    const branch = await this.branchPort.findBySlug(input.branchSlug);
    if (!branch || !branch.slug) {
      throw new ValidationError("Outlet tidak ditemukan atau pickup belum diaktifkan.");
    }

    // ── 2. Validate required fields ──
    const customerName = input.customerName?.trim();
    const rawPhone = input.customerPhone?.trim();
    if (!customerName) {
      throw new ValidationError("Nama wajib diisi.");
    }
    if (!rawPhone) {
      throw new ValidationError("Nomor telepon wajib diisi.");
    }
    const customerPhone = normalizePhone(rawPhone);
    if (!customerPhone) {
      throw new ValidationError("Nomor telepon salah.");
    }

    // ── 3. Location: require either GPS coords OR manual address ──
    const hasGps =
      typeof input.latitude === "number" && typeof input.longitude === "number";
    const addressText = input.addressText?.trim() || null;
    if (!hasGps && !addressText) {
      throw new ValidationError(
        "Bagikan lokasi atau masukkan alamat agar bisa kami temukan.",
      );
    }

    // Validate GPS ranges so we don't store impossible coordinates or
    // produce broken maps URLs.
    if (hasGps) {
      const lat = input.latitude as number;
      const lng = input.longitude as number;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new ValidationError("Koordinat lokasi tidak valid.");
      }
    }

    const latitude = hasGps ? (input.latitude as number) : null;
    const longitude = hasGps ? (input.longitude as number) : null;
    const mapsLink =
      hasGps ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;

    // ── 4. Optional email ──
    const customerEmail = input.customerEmail?.trim() || null;
    if (customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      throw new ValidationError("Format email salah.");
    }

    // ── 5. Optional scheduling (customer can pre-pick a slot) ──
    let requestedDate: Date | null = null;
    if (input.requestedDate) {
      const d = new Date(input.requestedDate);
      if (isNaN(d.getTime())) {
        throw new ValidationError("Tanggal pengambilan tidak valid.");
      }
      // Normalize to midnight UTC to avoid timezone drift in date-only fields
      requestedDate = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    }
    const requestedSlot = input.requestedSlot?.trim() || null;

    // ── 6. Persist ──
    const data: CreatePickupRequestData = {
      tenantId: branch.tenantId,
      branchId: branch.id,
      // Pickup-eligible branches today are laundry; the field is extensible.
      module: (branch.module ?? "LAUNDRY") as BusinessModule,
      customerName,
      customerPhone,
      customerEmail,
      latitude,
      longitude,
      addressText,
      mapsLink,
      requestedDate,
      requestedSlot,
      notes: input.notes?.trim() || null,
    };

    return this.pickupRepo.create(data);
  }
}

/**
 * Normalize an Indonesian phone number to international format (no spaces).
 * Strips non-digits, converts leading 0 to +62. Returns "" if invalid.
 */
function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "");
  if (/^\+62\d{8,13}$/.test(digits)) return digits;
  if (/^62\d{8,13}$/.test(digits)) return `+${digits}`;
  if (/^0\d{8,13}$/.test(digits)) return `+62${digits.slice(1)}`;
  return "";
}
