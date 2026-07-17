import { prisma } from "@/lib/prisma";
import type {
  StockItemRepository,
  StockItemRecord,
  StockItemWithCount,
  ListStockItemsQuery,
  CreateStockItemData,
  UpdateStockItemData,
} from "../domain/repository.port";

function mapRecord(s: any): StockItemRecord {
  return {
    id: s.id,
    name: s.name,
    unit: s.unit,
    currentQuantity: Number(s.currentQuantity),
    lowStockThreshold: Number(s.lowStockThreshold),
    purchasePricePerUnit: Number(s.purchasePricePerUnit),
    isActive: s.isActive,
    branchId: s.branchId,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  };
}

function mapWithCount(s: any): StockItemWithCount {
  return {
    ...mapRecord(s),
    movementCount: s._count?.movements ?? 0,
  };
}

export class PrismaStockItemRepository implements StockItemRepository {
  async findMany(query: ListStockItemsQuery): Promise<StockItemWithCount[]> {
    const rows = await prisma.stockItem.findMany({
      where: {
        branchId: query.branchId,
        ...(query.includeInactive ? {} : { isActive: true }),
      },
      include: {
        _count: { select: { movements: true } },
      },
      orderBy: { name: "asc" },
    });
    return rows.map(mapWithCount);
  }

  async findById(id: string, branchId: string): Promise<StockItemRecord | null> {
    const s = await prisma.stockItem.findFirst({
      where: { id, branchId },
    });
    return s ? mapRecord(s) : null;
  }

  async create(data: CreateStockItemData): Promise<StockItemRecord> {
    const s = await prisma.stockItem.create({
      data: {
        name: data.name,
        unit: data.unit,
        currentQuantity: data.currentQuantity ?? 0,
        lowStockThreshold: data.lowStockThreshold,
        purchasePricePerUnit: data.purchasePricePerUnit,
        isActive: data.isActive ?? true,
        branchId: data.branchId,
      },
    });
    return mapRecord(s);
  }

  async update(id: string, branchId: string, data: UpdateStockItemData): Promise<StockItemRecord> {
    const s = await prisma.stockItem.update({
      where: { id, branchId },
      data,
    });
    return mapRecord(s);
  }

  async softDelete(id: string, branchId: string): Promise<void> {
    await prisma.stockItem.update({
      where: { id, branchId },
      data: { isActive: false },
    });
  }
}
