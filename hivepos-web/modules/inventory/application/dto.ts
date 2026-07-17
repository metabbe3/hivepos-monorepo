import type { StockMovementType } from "../domain/types";

export interface CreateStockItemInput {
  name: string;
  unit: string;
  currentQuantity?: number;
  lowStockThreshold: number;
  purchasePricePerUnit: number;
  isActive?: boolean;
}

export interface UpdateStockItemInput {
  name?: string;
  unit?: string;
  currentQuantity?: number;
  lowStockThreshold?: number;
  purchasePricePerUnit?: number;
  isActive?: boolean;
}

export interface CreateMovementInput {
  type: StockMovementType;
  quantity: number;
  notes?: string | null;
  date: string;
}

export interface StockItemDTO {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  purchasePricePerUnit: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  movementCount: number;
}

export interface StockMovementDTO {
  id: string;
  stockItemId: string;
  type: StockMovementType;
  quantity: number;
  date: string;
  notes: string | null;
  createdAt: string;
}
