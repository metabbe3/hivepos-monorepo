import { NotFoundError } from "@/modules/shared";
import { parseDateRange } from "@/lib/dates";
import type { CustomerStatsRepository, CustomerRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { CustomerDateRangeInput } from "./dto";

export class CustomerStatsService {
  constructor(
    private statsRepo: CustomerStatsRepository,
    private customerRepo: CustomerRepository,
  ) {}

  async execute(customerId: string, dateRange: CustomerDateRangeInput, ctx: RequestContext) {
    // Verify customer exists
    const customer = await this.customerRepo.findById(customerId, ctx.branchId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const range = parseDateRange(dateRange);
    return this.statsRepo.getStats(customerId, ctx.branchId, range);
  }
}
