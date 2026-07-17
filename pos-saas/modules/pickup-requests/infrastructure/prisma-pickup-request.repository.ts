import { prisma } from "@/lib/prisma";
import { NotFoundError, ConflictError } from "@/modules/shared";
import type { Prisma } from "@/app/generated/prisma/client";
import type {
  PickupRequestRepository,
  CreatePickupRequestData,
  ListPickupRequestsQuery,
  StatusPatch,
} from "../domain/repository.port";
import type { PickupRequest, PickupRequestStatus, BusinessModule } from "../domain/types";

/** Convert a raw Prisma row to the domain record (numbers/Enums already JS-native here). */
function toDomain(row: PrismaPickupRow): PickupRequest {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    module: row.module as BusinessModule,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    customerId: row.customerId,
    latitude: row.latitude,
    longitude: row.longitude,
    addressText: row.addressText,
    mapsLink: row.mapsLink,
    requestedDate: row.requestedDate,
    requestedSlot: row.requestedSlot,
    status: row.status as PickupRequestStatus,
    notes: row.notes,
    assignedDriverId: row.assignedDriverId,
    convertedOrderId: row.convertedOrderId,
    convertedAt: row.convertedAt,
    rejectedReason: row.rejectedReason,
    rejectedAt: row.rejectedAt,
    rejectedById: row.rejectedById,
    acceptedAt: row.acceptedAt,
    acceptedById: row.acceptedById,
    scheduledAt: row.scheduledAt,
    scheduledById: row.scheduledById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type PrismaPickupRow = {
  id: string;
  tenantId: string;
  branchId: string;
  module: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerId: string | null;
  latitude: number | null;
  longitude: number | null;
  addressText: string | null;
  mapsLink: string | null;
  requestedDate: Date | null;
  requestedSlot: string | null;
  status: string;
  notes: string | null;
  assignedDriverId: string | null;
  convertedOrderId: string | null;
  convertedAt: Date | null;
  rejectedReason: string | null;
  rejectedAt: Date | null;
  rejectedById: string | null;
  acceptedAt: Date | null;
  acceptedById: string | null;
  scheduledAt: Date | null;
  scheduledById: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** Fields every query selects — keeps the row-to-domain mapping stable. */
const PICKUP_SELECT = {
  id: true,
  tenantId: true,
  branchId: true,
  module: true,
  customerName: true,
  customerPhone: true,
  customerEmail: true,
  customerId: true,
  latitude: true,
  longitude: true,
  addressText: true,
  mapsLink: true,
  requestedDate: true,
  requestedSlot: true,
  status: true,
  notes: true,
  assignedDriverId: true,
  convertedOrderId: true,
  convertedAt: true,
  rejectedReason: true,
  rejectedAt: true,
  rejectedById: true,
  acceptedAt: true,
  acceptedById: true,
  scheduledAt: true,
  scheduledById: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PickupRequestSelect;

export class PrismaPickupRequestRepository implements PickupRequestRepository {
  async create(data: CreatePickupRequestData): Promise<PickupRequest> {
    const row = await prisma.pickupRequest.create({
      data: {
        tenantId: data.tenantId,
        branchId: data.branchId,
        module: data.module,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerEmail: data.customerEmail,
        latitude: data.latitude,
        longitude: data.longitude,
        addressText: data.addressText,
        mapsLink: data.mapsLink,
        requestedDate: data.requestedDate,
        requestedSlot: data.requestedSlot,
        notes: data.notes,
      },
      select: PICKUP_SELECT,
    });
    return toDomain(row);
  }

  async findById(
    id: string,
    branchIds: string[],
  ): Promise<PickupRequest | null> {
    const row = await prisma.pickupRequest.findFirst({
      where: { id, branchId: { in: branchIds } },
      select: PICKUP_SELECT,
    });
    return row ? toDomain(row as PrismaPickupRow) : null;
  }

  async list(
    query: ListPickupRequestsQuery,
  ): Promise<{ items: PickupRequest[]; total: number }> {
    const where: Prisma.PickupRequestWhereInput = {
      branchId: { in: query.branchIds },
      ...(query.module ? { module: query.module } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              { customerName: { contains: query.search, mode: "insensitive" } },
              { customerPhone: { contains: query.search } },
            ],
          }
        : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.pickupRequest.findMany({
        where,
        select: PICKUP_SELECT,
        orderBy: { createdAt: "desc" },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.pickupRequest.count({ where }),
    ]);

    return { items: rows.map((r) => toDomain(r as PrismaPickupRow)), total };
  }

  async updateStatus(
    id: string,
    branchIds: string[],
    patch: StatusPatch,
  ): Promise<PickupRequest> {
    // Build the update data, mapping optional patch fields to undefined-skipped Prisma input.
    const data: Prisma.PickupRequestUpdateInput = {
      status: patch.status,
      ...(patch.acceptedAt !== undefined ? { acceptedAt: patch.acceptedAt } : {}),
      ...(patch.acceptedById !== undefined
        ? { acceptedById: patch.acceptedById }
        : {}),
      ...(patch.scheduledAt !== undefined
        ? { scheduledAt: patch.scheduledAt }
        : {}),
      ...(patch.scheduledById !== undefined
        ? { scheduledById: patch.scheduledById }
        : {}),
      ...(patch.rejectedAt !== undefined ? { rejectedAt: patch.rejectedAt } : {}),
      ...(patch.rejectedById !== undefined
        ? { rejectedById: patch.rejectedById }
        : {}),
      ...(patch.rejectedReason !== undefined
        ? { rejectedReason: patch.rejectedReason }
        : {}),
      ...(patch.convertedAt !== undefined ? { convertedAt: patch.convertedAt } : {}),
      ...(patch.requestedDate !== undefined
        ? { requestedDate: patch.requestedDate }
        : {}),
      ...(patch.requestedSlot !== undefined
        ? { requestedSlot: patch.requestedSlot }
        : {}),
      ...(patch.assignedDriverId !== undefined
        ? { assignedDriverId: patch.assignedDriverId }
        : {}),
      ...(patch.customerId !== undefined
        ? patch.customerId === null
          ? { customer: { disconnect: true } }
          : { customer: { connect: { id: patch.customerId } } }
        : {}),
    };

    const row = await prisma.pickupRequest.updateMany({
      where: { id, branchId: { in: branchIds } },
      data,
    });

    if (row.count === 0) {
      // Either the row doesn't exist or it's outside the caller's branches.
      throw new NotFoundError("PickupRequest", id);
    }

    // updateMany doesn't return the row; re-read it for the response.
    const refreshed = await prisma.pickupRequest.findFirst({
      where: { id, branchId: { in: branchIds } },
      select: PICKUP_SELECT,
    });
    if (!refreshed) throw new NotFoundError("PickupRequest", id);
    return toDomain(refreshed as PrismaPickupRow);
  }

  async linkConverted(
    id: string,
    branchIds: string[],
    orderId: string,
  ): Promise<{ orderId: string }> {
    const now = new Date();
    // Atomically claim the row: only SCHEDULED + unconverted rows match.
    // This makes the convert flow safe under concurrent requests — the
    // loser of the race gets count=0 and falls through to the re-read below.
    const result = await prisma.pickupRequest.updateMany({
      where: {
        id,
        branchId: { in: branchIds },
        status: "SCHEDULED",
        convertedOrderId: null,
      },
      data: {
        convertedOrderId: orderId,
        convertedAt: now,
        status: "CONVERTED",
      },
    });

    if (result.count > 0) {
      return { orderId };
    }

    // 0 rows could mean: not found, not SCHEDULED, or already converted.
    // Re-read to disambiguate — if already converted, return the existing
    // orderId so the caller's idempotency holds.
    const existing = await prisma.pickupRequest.findFirst({
      where: { id, branchId: { in: branchIds } },
      select: { convertedOrderId: true, status: true },
    });
    if (!existing) throw new NotFoundError("PickupRequest", id);
    if (existing.convertedOrderId) {
      return { orderId: existing.convertedOrderId };
    }
    // Status is not SCHEDULED and not yet converted → conflict.
    throw new ConflictError(
      `Pickup request cannot be converted from status ${existing.status}`,
    );
  }

  async countPending(branchIds: string[]): Promise<number> {
    return prisma.pickupRequest.count({
      where: { branchId: { in: branchIds }, status: "PENDING" },
    });
  }
}
