import { PrismaStockItemRepository } from "./infrastructure/prisma-stock-item.repository";
import { PrismaStockMovementRepository } from "./infrastructure/prisma-stock-movement.repository";
import {
  ListStockItemsService,
  CreateStockItemService,
  UpdateStockItemService,
  DeleteStockItemService,
} from "./application/stock-item-services";
import {
  RecordMovementService,
  ListMovementsService,
} from "./application/movement-services";

// ── Infrastructure singletons ──────────────────────────────────────────
const stockItemRepo = new PrismaStockItemRepository();
const movementRepo = new PrismaStockMovementRepository();

// ── Application service singletons ─────────────────────────────────────
export const listStockItemsService = new ListStockItemsService(stockItemRepo);
export const createStockItemService = new CreateStockItemService(stockItemRepo);
export const updateStockItemService = new UpdateStockItemService(stockItemRepo);
export const deleteStockItemService = new DeleteStockItemService(stockItemRepo);

export const recordMovementService = new RecordMovementService(movementRepo, stockItemRepo);
export const listMovementsService = new ListMovementsService(movementRepo, stockItemRepo);
