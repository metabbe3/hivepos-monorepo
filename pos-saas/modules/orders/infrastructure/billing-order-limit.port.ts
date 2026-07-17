import { checkLimit, type LimitCheckResult } from "@/lib/billing";
import type { OrderLimitPort, OrderLimitResult } from "../application/ports";

export class BillingOrderLimitPort implements OrderLimitPort {
  async checkOrderLimit(tenantId: string): Promise<OrderLimitResult> {
    const result: LimitCheckResult = await checkLimit(tenantId, "orders");
    return {
      allowed: result.allowed,
      current: result.current,
      max: result.max,
      ...(result.reason ? { reason: result.reason } : {}),
    };
  }
}
