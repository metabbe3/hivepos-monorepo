import type { BillingRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { ValidatePromoInput, ValidatePromoResult } from "./dto";
import {
  PRICE_PER_OUTLET,
  ORIGINAL_PRICE_PER_OUTLET,
  PRO_PRICE_PER_OUTLET,
  calculateBill,
} from "../domain/types";
import { ValidationError } from "@/modules/shared";

export class ValidatePromoService {
  constructor(private repo: BillingRepository) {}

  async execute(
    input: ValidatePromoInput,
    ctx: RequestContext,
  ): Promise<ValidatePromoResult> {
    if (!input.code) {
      throw new ValidationError("Kode promo wajib diisi.");
    }

    const result = await this.repo.validatePromoCode(
      input.code,
      ctx.tenantId,
      input.planTier,
    );
    if (!result.valid || !result.promoCode) {
      return { valid: false, error: result.error };
    }

    // Determine outlet count: use provided branchIds, else count paid branches
    let outletCount: number;
    let months: number;

    if (input.branchIds && input.branchIds.length > 0) {
      outletCount = input.branchIds.length;
      months = Math.max(1, Math.min(12, input.months || 1));
    } else {
      outletCount = await this.repo.countPaidBranches(ctx.tenantId);
      outletCount = Math.max(outletCount, 1);
      months = 1;
    }

    const unitPrice =
      input.planTier === "PRO" ? PRO_PRICE_PER_OUTLET : PRICE_PER_OUTLET;
    const calc = calculateBill(outletCount, months, result.promoCode as any, unitPrice);

    return {
      valid: true,
      promoCode: {
        code: result.promoCode.code,
        type: result.promoCode.type,
        description: result.promoCode.description,
      },
      calculation: {
        unitPrice,
        originalUnitPrice: ORIGINAL_PRICE_PER_OUTLET,
        outletCount,
        months,
        grossTotal: calc.grossTotal,
        discount: calc.discount,
        total: calc.total,
        freeMonths: calc.freeMonths,
      },
    };
  }
}
