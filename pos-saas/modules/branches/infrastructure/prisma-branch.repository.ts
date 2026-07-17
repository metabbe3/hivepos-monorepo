import { prisma, Prisma } from "@/lib/prisma";
import type {
  BranchRepository,
  CreateBranchRecord,
  UpdateBranchRecord,
} from "../domain/repository.port";
import type { BranchListItem, BranchDetail } from "../domain/types";

export class PrismaBranchRepository implements BranchRepository {
  async findMany(tenantId: string): Promise<BranchListItem[]> {
    const branches = await prisma.branch.findMany({
      where: { tenantId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { users: true, orders: true, services: true, customers: true } },
      },
    });
    return branches.map((b) => ({
      id: b.id,
      name: b.name,
      address: b.address,
      phone: b.phone,
      isActive: b.isActive,
      isFreeTier: b.isFreeTier,
      coverageEnd: b.coverageEnd,
      createdAt: b.createdAt,
      counts: {
        users: b._count.users,
        orders: b._count.orders,
        services: b._count.services,
        customers: b._count.customers,
      },
    }));
  }

  async findDetailById(id: string, tenantId: string): Promise<BranchDetail | null> {
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        users: { select: { id: true, name: true, email: true, role: true } },
        _count: { select: { orders: true, services: true, customers: true } },
      },
    });
    if (!branch || branch.tenantId !== tenantId) return null;

    return {
      id: branch.id,
      name: branch.name,
      address: branch.address,
      phone: branch.phone,
      invoiceFooter: branch.invoiceFooter,
      latitude: branch.latitude,
      longitude: branch.longitude,
      googleMapsLink: branch.googleMapsLink,
      whatsappLink: branch.whatsappLink,
      operatingHours: branch.operatingHours as Record<string, string> | null,
      printerHost: branch.printerHost,
      printerPort: branch.printerPort,
      printerName: branch.printerName,
      printerEnabled: branch.printerEnabled,
      printerPaperSize: branch.printerPaperSize,
      isActive: branch.isActive,
      isFreeTier: branch.isFreeTier,
      coverageEnd: branch.coverageEnd,
      createdAt: branch.createdAt,
      users: branch.users,
      counts: {
        orders: branch._count.orders,
        services: branch._count.services,
        customers: branch._count.customers,
      },
    };
  }

  async count(tenantId: string): Promise<number> {
    return prisma.branch.count({ where: { tenantId } });
  }

  async create(data: CreateBranchRecord): Promise<{ id: string }> {
    const { operatingHours, ...rest } = data;
    const branch = await prisma.branch.create({
      data: {
        ...rest,
        operatingHours:
          operatingHours === null || operatingHours === undefined
            ? Prisma.JsonNull
            : (operatingHours as any),
      },
      select: { id: true },
    });
    return branch;
  }

  async update(id: string, data: UpdateBranchRecord): Promise<{ id: string }> {
    const branch = await prisma.branch.update({
      where: { id },
      data: data as any,
      select: { id: true },
    });
    return branch;
  }
}
