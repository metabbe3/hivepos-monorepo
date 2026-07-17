import type { PickupRequestStatus, BusinessModule } from "../domain/types";

// ── Input DTOs (what the API layer passes in) ───────────────────────────

/** Public submission from the customer pickup form (no auth). */
export interface CreatePickupRequestInput {
  branchSlug: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  latitude?: number;
  longitude?: number;
  addressText?: string;
  requestedDate?: string;
  requestedSlot?: string;
  notes?: string;
}

export interface ListPickupRequestsInput {
  status?: PickupRequestStatus | "ALL";
  search?: string;
  page?: string;
  limit?: string;
}

export interface SchedulePickupInput {
  requestedDate: string;
  requestedSlot: string;
  assignedDriverId?: string;
}

export interface RejectPickupInput {
  reason?: string;
}

export interface AssignDriverInput {
  assignedDriverId: string | null;
}

// ── Output DTOs ─────────────────────────────────────────────────────────

export type PickupRequestDTO = {
  id: string;
  branchId: string;
  module: BusinessModule;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerId: string | null;
  latitude: number | null;
  longitude: number | null;
  addressText: string | null;
  mapsLink: string | null;
  requestedDate: string | null;
  requestedSlot: string | null;
  status: PickupRequestStatus;
  notes: string | null;
  assignedDriverId: string | null;
  convertedOrderId: string | null;
  convertedAt: string | null;
  rejectedReason: string | null;
  rejectedAt: string | null;
  acceptedAt: string | null;
  scheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PickupListDTO = {
  items: PickupRequestDTO[];
  total: number;
  page: number;
  totalPages: number;
};
