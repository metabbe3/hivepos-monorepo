import type { StockMovementType } from "./types";

// ── Persistence shapes ─────────────────────────────────────────────────

export interface StockItemRecord {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  purchasePricePerUnit: number;
  isActive: boolean;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StockItemWithCount extends StockItemRecord {
  movementCount: number;
}

export interface StockMovementRecord {
  id: string;
  stockItemId: string;
  type: StockMovementType;
  quantity: number;
  date: Date;
  notes: string | null;
  createdAt: Date;
}

// ── Query/input shapes ────────────────────────────────────────────────

export interface ListStockItemsQuery {
  branchId: string;
  includeInactive?: boolean;
}

export interface CreateStockItemData {
  name: string;
  unit: string;
  currentQuantity?: number;
  lowStockThreshold: number;
  purchasePricePerUnit: number;
  isActive?: boolean;
  branchId: string;
}

export interface UpdateStockItemData {
  name?: string;
  unit?: string;
  currentQuantity?: number;
  lowStockThreshold?: number;
  purchasePricePerUnit?: number;
  isActive?: boolean;
}

export interface CreateMovementData {
  stockItemId: string;
  type: StockMovementType;
  quantity: number;
  notes?: string | null;
  date: Date;
}

// ── Repository ports ───────────────────────────────────────────────────

export interface StockItemRepository {
  findMany(query: ListStockItemsQuery): Promise<StockItemWithCount[]>;
  findById(id: string, branchId: string): Promise<StockItemRecord | null>;
  create(data: CreateStockItemData): Promise<StockItemRecord>;
  update(id: string, branchId: string, data: UpdateStockItemData): Promise<StockItemRecord>;
  softDelete(id: string, branchId: string): Promise<void>;
}

export interface StockMovementRepository {
  findMany(stockItemId: string): Promise<StockMovementRecord[]>;
  /**
   * Records a movement and updates the stock item quantity atomically.
   * Throws when an OUT movement would make quantity negative.
   */
  recordMovement(
    stockItemId: string,
    data: CreateMovementData,
  ): Promise<StockMovementRecord>;
}
