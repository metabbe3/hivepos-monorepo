import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { prisma } from "@/lib/prisma";

export const GET = withErrorHandler(async (req) => {
  const ctx = await requireWithBranchOrThrow("reports", "read");
  const { branchIds } = ctx;

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  // Build date filter for recent purchases (StockMovement IN)
  const movementDateFilter: any = {};
  if (from) movementDateFilter.date = { ...movementDateFilter.date, gte: new Date(from) };
  if (to) movementDateFilter.date = { ...movementDateFilter.date, lte: new Date(to + "T23:59:59") };

  const [stockItems, recentPurchases] = await Promise.all([
    prisma.stockItem.findMany({
      where: { branchId: { in: branchIds }, isActive: true },
      select: {
        id: true,
        name: true,
        unit: true,
        currentQuantity: true,
        lowStockThreshold: true,
        purchasePricePerUnit: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.stockMovement.findMany({
      where: {
        stockItem: { branchId: { in: branchIds } },
        type: "IN",
        ...(Object.keys(movementDateFilter).length > 0 ? movementDateFilter : {}),
      },
      select: {
        id: true,
        quantity: true,
        date: true,
        notes: true,
        stockItem: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 50,
    }),
  ]);

  // Compute derived values
  const stockItemsWithValue = stockItems.map((item) => {
    const qty = Number(item.currentQuantity);
    const price = Number(item.purchasePricePerUnit);
    return {
      id: item.id,
      name: item.name,
      unit: item.unit,
      currentQuantity: qty,
      lowStockThreshold: Number(item.lowStockThreshold),
      purchasePricePerUnit: price,
      stockValue: qty * price,
    };
  });

  const totalStockValue = stockItemsWithValue.reduce((sum, item) => sum + item.stockValue, 0);

  const lowStockItems = stockItemsWithValue.filter(
    (item) => item.currentQuantity <= item.lowStockThreshold
  );

  return apiSuccess({
    summary: {
      totalItems: stockItemsWithValue.length,
      totalValue: totalStockValue,
      lowStockCount: lowStockItems.length,
      recentPurchases: recentPurchases.length,
    },
    stockLevels: stockItemsWithValue.map((item) => ({
      name: item.name,
      unit: item.unit,
      quantity: item.currentQuantity,
      threshold: item.lowStockThreshold,
      value: item.stockValue,
      isLow: item.currentQuantity <= item.lowStockThreshold,
    })),
    recentMovements: recentPurchases.map((m) => ({
      name: m.stockItem.name,
      type: "IN",
      quantity: Number(m.quantity),
      date: m.date,
      notes: m.notes,
    })),
  });
});
