/**
 * Domain-level type definitions for the Pickup Requests bounded context.
 *
 * These mirror the Prisma enums but are declared locally so the domain layer
 * has zero infrastructure dependencies (no Prisma import). The infrastructure
 * layer is responsible for mapping between these and Prisma's generated enums.
 */

export type PickupRequestStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "CONVERTED"
  | "REJECTED"
  | "CANCELED";

/**
 * Re-exported from the shared domain kernel. Previously defined locally with
 * the same shape; consolidated to a single source of truth.
 */
import type { BusinessModule } from "@/modules/shared/domain/business-module";
export type { BusinessModule };

/** Persisted pickup request (list / detail view). */
export interface PickupRequest {
  id: string;
  tenantId: string;
  branchId: string;
  module: BusinessModule;

  // Customer snapshot (denormalized)
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerId: string | null;

  // Location
  latitude: number | null;
  longitude: number | null;
  addressText: string | null;
  mapsLink: string | null;

  // Scheduling
  requestedDate: Date | null;
  requestedSlot: string | null;

  // Lifecycle
  status: PickupRequestStatus;
  notes: string | null;
  assignedDriverId: string | null;

  // Conversion linkage
  convertedOrderId: string | null;
  convertedAt: Date | null;

  // Audit trail
  rejectedReason: string | null;
  rejectedAt: Date | null;
  rejectedById: string | null;
  acceptedAt: Date | null;
  acceptedById: string | null;
  scheduledAt: Date | null;
  scheduledById: string | null;

  createdAt: Date;
  updatedAt: Date;
}
