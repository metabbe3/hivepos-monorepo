import { prisma } from "@/lib/prisma";
import type {
  ServiceRepository,
  ServiceWithGroup,
  ServiceRecord,
  ListServicesQuery,
  CreateServiceData,
  UpdateServiceData,
} from "../domain/repository.port";
import type { PricingType, CommissionType, BusinessModule } from "../domain/types";

const include = { group: { select: { id: true, name: true } } };

function mapRecord(s: any): ServiceWithGroup {
  return {
    id: s.id,
    name: s.name,
    description: s.description,
    pricingType: s.pricingType as PricingType,
    basePrice: Number(s.basePrice),
    commissionType: s.commissionType as CommissionType,
    commissionValue: Number(s.commissionValue),
    module: s.module as BusinessModule,
    isActive: s.isActive,
    isDefaultSpeed: s.isDefaultSpeed,
    branchId: s.branchId,
    groupId: s.groupId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
    group: s.group ?? null,
  };
}

export class PrismaServiceRepository implements ServiceRepository {
  async findMany(query: ListServicesQuery): Promise<ServiceWithGroup[]> {
    const rows = await prisma.service.findMany({
      where: {
        branchId: query.branchId,
        module: query.module,
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: "asc" },
      include,
    });
    return rows.map(mapRecord);
  }

  async findInactiveByName(
    name: string,
    branchId: string,
  ): Promise<ServiceRecord | null> {
    const s = await prisma.service.findFirst({
      where: { branchId, name, isActive: false },
    });
    if (!s) return null;
    const { group: _group, ...rest } = mapRecord({ ...s, group: null });
    return rest;
  }

  async create(data: CreateServiceData): Promise<ServiceWithGroup> {
    const s = await prisma.service.create({
      data: {
        name: data.name,
        description: data.description,
        pricingType: data.pricingType,
        basePrice: data.basePrice,
        commissionType: data.commissionType ?? "NONE",
        commissionValue: data.commissionValue ?? 0,
        module: data.module,
        isActive: data.isActive ?? true,
        isDefaultSpeed: data.isDefaultSpeed ?? false,
        branchId: data.branchId,
        ...(data.groupId ? { groupId: data.groupId } : {}),
      },
      include,
    });
    return mapRecord(s);
  }

  async reactivate(id: string, data: CreateServiceData): Promise<ServiceWithGroup> {
    const s = await prisma.service.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        pricingType: data.pricingType,
        basePrice: data.basePrice,
        commissionType: data.commissionType ?? "NONE",
        commissionValue: data.commissionValue ?? 0,
        module: data.module,
        isActive: true,
        isDefaultSpeed: data.isDefaultSpeed ?? false,
        groupId: data.groupId ?? null,
      },
      include,
    });
    return mapRecord(s);
  }

  async update(
    id: string,
    branchId: string,
    data: UpdateServiceData,
  ): Promise<ServiceWithGroup> {
    const { groupId, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (groupId !== undefined) {
      updateData.groupId = groupId || null;
    }

    const s = await prisma.service.update({
      where: { id, branchId },
      data: updateData,
      include,
    });
    return mapRecord(s);
  }

  async softDelete(id: string, branchId: string): Promise<void> {
    await prisma.service.update({
      where: { id, branchId },
      data: { isActive: false },
    });
  }
}
