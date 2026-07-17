import { prisma } from "@/lib/prisma";
import type {
  StockMovementRepository,
  StockMovementRecord,
  CreateMovementData,
} from "../domain/repository.port";
import type { StockMovementType } from "../domain/types";

function mapRecord(m: any): StockMovementRecord {
  return {
    id: m.id,
    stockItemId: m.stockItemId,
    type: m.type as StockMovementType,
    quantity: Number(m.quantity),
    date: m.date,
    notes: m.notes,
    createdAt: m.createdAt,
  };
}

export class PrismaStockMovementRepository implements StockMovementRepository {
  async findMany(stockItemId: string): Promise<StockMovementRecord[]> {
    const rows = await prisma.stockMovement.findMany({
      where: { stockItemId },
      orderBy: { date: "desc" },
    });
    return rows.map(mapRecord);
  }

  async recordMovement(
    stockItemId: string,
    data: CreateMovementData,
  ): Promise<StockMovementRecord> {
    const movement = await prisma.$transaction(async (tx) => {
      // Re-fetch inside transaction for the current quantity
      const item = await tx.stockItem.findUniqueOrThrow({
        where: { id: stockItemId },
      });

      const currentQty = Number(item.currentQuantity);

      if (data.type === "OUT" && currentQty < data.quantity) {
        throw new Error(
          `Insufficient stock. Current quantity: ${currentQty}`,
        );
      }

      const newMovement = await tx.stockMovement.create({
        data: {
          stockItemId,
          type: data.type,
          quantity: data.quantity,
          notes: data.notes ?? null,
          date: data.date,
        },
      });

      await tx.stockItem.update({
        where: { id: stockItemId },
        data: {
          currentQuantity: {
            [data.type === "IN" ? "increment" : "decrement"]: data.quantity,
          },
        },
      });

      return newMovement;
    });

    return mapRecord(movement);
  }
}
