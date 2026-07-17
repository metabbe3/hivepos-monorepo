/**
 * Domain-level type definitions for the Orders bounded context.
 *
 * These mirror the Prisma enums but are declared locally so the domain layer
 * has zero infrastructure dependencies (no Prisma import). The infrastructure
 * layer is responsible for mapping between these and Prisma's generated enums.
 */

export type OrderStatus =
  | "RECEIVED"
  | "IN_PROGRESS"
  | "READY"
  | "DELIVERED"
  | "CANCELED";

export type PaymentMethod = "CASH" | "TRANSFER" | "QRIS" | "DEPOSIT";

export type PaymentStatus = "PENDING" | "PARTIAL" | "PAID" | "REFUNDED";

/**
 * Re-exported from the shared domain kernel so existing import paths
 * (`@/modules/orders/domain/types`) keep working. The canonical definition
 * lives in `@/modules/shared/domain/business-module`.
 */
import type { BusinessModule } from "@/modules/shared/domain/business-module";
export type { BusinessModule };

export type PricingType = "PER_KG" | "PER_ITEM" | "FLAT";

export type DiscountType = "PERCENTAGE" | "FIXED";

/** Input shape for a single order line item (before pricing is applied). */
export interface OrderItemInput {
  serviceId: string;
  quantity: number;
  weightKg?: number;
  notes?: string;
  garmentBreakdown?: Array<{ name: string; qty: number }>;
}

/** A service's pricing snapshot used to compute an item's subtotal. */
export interface ServicePricing {
  id: string;
  basePrice: number;
  pricingType: PricingType;
  module: BusinessModule;
}
