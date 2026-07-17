import type { PickupRequest } from "../domain/types";
import type { PickupRequestDTO } from "./dto";
import { toIso, toIsoRequired } from "@/modules/shared/serialization";

/** Map a persisted PickupRequest to its API DTO (serializes Dates to ISO strings). */
export function toPickupDTO(r: PickupRequest): PickupRequestDTO {
  return {
    id: r.id,
    branchId: r.branchId,
    module: r.module,
    customerName: r.customerName,
    customerPhone: r.customerPhone,
    customerEmail: r.customerEmail,
    customerId: r.customerId,
    latitude: r.latitude,
    longitude: r.longitude,
    addressText: r.addressText,
    mapsLink: r.mapsLink,
    requestedDate: toIso(r.requestedDate),
    requestedSlot: r.requestedSlot,
    status: r.status,
    notes: r.notes,
    assignedDriverId: r.assignedDriverId,
    convertedOrderId: r.convertedOrderId,
    convertedAt: toIso(r.convertedAt),
    rejectedReason: r.rejectedReason,
    rejectedAt: toIso(r.rejectedAt),
    acceptedAt: toIso(r.acceptedAt),
    scheduledAt: toIso(r.scheduledAt),
    createdAt: toIsoRequired(r.createdAt),
    updatedAt: toIsoRequired(r.updatedAt),
  };
}
