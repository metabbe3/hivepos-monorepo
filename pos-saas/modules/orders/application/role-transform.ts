import type { PaymentStatus } from "../domain/types";
import type {
  OrderRecord,
  OrderDetailRecord,
} from "../domain/repository.port";
import type { RequestContext } from "./context";
import { hasPermission } from "./context";

/**
 * Whether the current user is allowed to see financial figures (totals,
 * payments, discounts). Tied to the "orders:discount" permission in the
 * existing RBAC model.
 */
export function canSeeFinancials(ctx: RequestContext): boolean {
  return hasPermission(ctx, "orders", "discount");
}

/**
 * Mask financial fields on an order record for users without the discount
 * permission. Non-destructive — returns a new object.
 */
export function maskOrderForRole(
  order: OrderRecord,
  ctx: RequestContext,
): OrderRecord {
  if (canSeeFinancials(ctx)) return order;

  return {
    ...order,
    paidAmount: 0,
    discountAmount: 0,
    discountType: null,
    paymentStatus: "PENDING" as PaymentStatus,
  };
}

/**
 * Mask financial fields on a detailed order record (including payments).
 */
export function maskOrderDetailForRole(
  order: OrderDetailRecord,
  ctx: RequestContext,
): OrderDetailRecord {
  if (canSeeFinancials(ctx)) return order;

  return {
    ...order,
    paidAmount: 0,
    discountAmount: 0,
    discountType: null,
    paymentStatus: "PENDING" as PaymentStatus,
    payments: [],
  };
}
