import type { PickupRequest, PickupRequestStatus, BusinessModule } from "./types";

// ── Persistence shapes ─────────────────────────────────────────────────

/** Data needed to create a new pickup request (public submission). */
export interface CreatePickupRequestData {
  tenantId: string;
  branchId: string;
  module: BusinessModule;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  latitude: number | null;
  longitude: number | null;
  addressText: string | null;
  mapsLink: string | null;
  requestedDate: Date | null;
  requestedSlot: string | null;
  notes: string | null;
}

/** List query filters. */
export interface ListPickupRequestsQuery {
  branchIds: string[];
  module?: BusinessModule;
  status?: PickupRequestStatus;
  search?: string;
  page: number;
  limit: number;
}

/** Patch applied when transitioning status. */
export interface StatusPatch {
  status: PickupRequestStatus;
  acceptedAt?: Date | null;
  acceptedById?: string | null;
  scheduledAt?: Date | null;
  scheduledById?: string | null;
  rejectedAt?: Date | null;
  rejectedById?: string | null;
  rejectedReason?: string | null;
  convertedAt?: Date | null;
  requestedDate?: Date | null;
  requestedSlot?: string | null;
  assignedDriverId?: string | null;
  customerId?: string | null;
}

// ── Port interfaces ────────────────────────────────────────────────────

/**
 * Persistence boundary for the PickupRequest aggregate.
 *
 * Application services depend on this interface; the infrastructure layer
 * provides a Prisma-backed implementation. Tests mock it.
 *
 * Lookup/update operations take `branchIds: string[]` so they scope correctly
 * in both single-branch and ALL-OUTLETS session modes.
 */
export interface PickupRequestRepository {
  create(data: CreatePickupRequestData): Promise<PickupRequest>;
  findById(id: string, branchIds: string[]): Promise<PickupRequest | null>;
  list(
    query: ListPickupRequestsQuery,
  ): Promise<{ items: PickupRequest[]; total: number }>;
  updateStatus(
    id: string,
    branchIds: string[],
    patch: StatusPatch,
  ): Promise<PickupRequest>;
  linkConverted(
    id: string,
    branchIds: string[],
    orderId: string,
  ): Promise<{ orderId: string }>;
  countPending(branchIds: string[]): Promise<number>;
}

/** Snapshot of branch fields needed by the pickup module. */
export interface BranchSnapshot {
  id: string;
  tenantId: string;
  slug: string | null;
  pickupSlots: unknown;
  module: BusinessModule;
}

/**
 * Narrow read-only port so the pickup module doesn't import the entire
 * branches module. Resolves branches by slug (public form) or id (staff UI).
 */
export interface BranchPort {
  findBySlug(slug: string): Promise<BranchSnapshot | null>;
  findById(id: string): Promise<BranchSnapshot | null>;
}

/** Result of find-or-create-by-phone for customer linkage. */
export interface CustomerLinkResult {
  customerId: string;
  created: boolean;
}

/**
 * Narrow customer port for the find-or-create-by-phone step in the
 * convert-to-order flow. Avoids importing the full customers module.
 */
export interface CustomerPort {
  findByPhone(
    phone: string,
    branchId: string,
  ): Promise<{ id: string } | null>;
  create(input: {
    name: string;
    phone: string;
    email?: string | null;
    branchId: string;
    tenantId: string;
  }): Promise<{ id: string }>;
}
