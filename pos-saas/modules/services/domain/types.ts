/** Domain-level types for the Services module. No Prisma imports. */

export type { BusinessModule } from "@/modules/orders/domain/types";

export type PricingType = "PER_KG" | "PER_ITEM" | "FLAT";

export type CommissionType = "NONE" | "FLAT" | "PERCENTAGE";
