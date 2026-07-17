import { Money } from "./money.vo";
import type {
  DiscountType,
  OrderItemInput,
  ServicePricing,
} from "./types";

/**
 * Calculate a single line item's subtotal from the service's pricing model.
 *
 * - PER_KG:  basePrice × weightKg (requires weightKg > 0)
 * - PER_ITEM: basePrice × quantity
 * - FLAT:    basePrice (flat fee regardless of quantity)
 */
export function calculateItemSubtotal(
  service: ServicePricing,
  item: OrderItemInput,
): Money {
  const unitPrice = new Money(service.basePrice);

  switch (service.pricingType) {
    case "PER_KG": {
      const weight = item.weightKg ?? 0;
      return unitPrice.multiply(weight);
    }
    case "PER_ITEM":
      return unitPrice.multiply(item.quantity);
    case "FLAT":
      return unitPrice;
    default:
      // Exhaustiveness check — if a new pricing type is added, this throws.
      return unitPrice;
  }
}

/** Sum a list of Money amounts into a single total. */
export function sumMoney(amounts: Money[]): Money {
  return amounts.reduce((acc, m) => acc.add(m), Money.zero());
}

/**
 * Calculate the total discount applied to an order.
 *
 * - PERCENTAGE: subtotal × amount / 100
 * - FIXED:      min(amount, subtotal) — never exceeds the order total
 */
export function calculateDiscount(
  subtotal: Money,
  type: DiscountType | null | undefined,
  amount: number | null | undefined,
): Money {
  if (!type || !amount || amount <= 0) return Money.zero();

  if (type === "PERCENTAGE") {
    return subtotal.percent(amount);
  }

  // FIXED — capped at subtotal so the total never goes negative.
  return new Money(amount).min(subtotal);
}

/**
 * Compute the full pricing breakdown for a set of items.
 *
 * Pure function: given the service pricing map and item inputs, returns every
 * line's subtotal plus the order subtotal, discount, and final total.
 */
export interface PricedItem {
  serviceId: string;
  quantity: number;
  weightKg: number | null;
  pricePerUnit: number;
  subtotal: number;
  notes: string | null;
  garmentBreakdown: Array<{ name: string; qty: number }> | null;
}

export interface PricingResult {
  items: PricedItem[];
  subtotal: Money;
  discount: Money;
  totalAmount: Money;
}

export function priceOrder(
  items: OrderItemInput[],
  services: Map<string, ServicePricing>,
  discountType?: DiscountType | null,
  discountAmount?: number,
): PricingResult {
  const pricedItems: PricedItem[] = items.map((item) => {
    const service = services.get(item.serviceId);
    if (!service) {
      throw new Error(`Service not found: ${item.serviceId}`);
    }

    const subtotal = calculateItemSubtotal(service, item);

    return {
      serviceId: item.serviceId,
      quantity: item.quantity,
      weightKg: item.weightKg ?? null,
      pricePerUnit: service.basePrice,
      subtotal: subtotal.amount,
      notes: item.notes ?? null,
      garmentBreakdown:
        item.garmentBreakdown && item.garmentBreakdown.length > 0
          ? item.garmentBreakdown
          : null,
    };
  });

  const subtotal = sumMoney(pricedItems.map((i) => new Money(i.subtotal)));
  const discount = calculateDiscount(subtotal, discountType, discountAmount);
  const totalAmount = subtotal.subtract(discount);

  return { items: pricedItems, subtotal, discount, totalAmount };
}
