/** Domain-level types for the Inventory module. No Prisma imports. */

export type { BusinessModule } from "@/modules/orders/domain/types";

export type StockMovementType = "IN" | "OUT" | "ADJUSTMENT";
