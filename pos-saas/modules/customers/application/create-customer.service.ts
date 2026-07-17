import { ConflictError } from "@/modules/shared";
import type { CustomerRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { CreateCustomerInput } from "./dto";

export class CreateCustomerService {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(input: CreateCustomerInput, ctx: RequestContext) {
    // Duplicate phone check (only if phone is provided)
    if (input.phone && input.phone.trim()) {
      const existing = await this.customerRepo.findByPhone(input.phone, ctx.branchId);
      if (existing) {
        throw new ConflictError("Customer with this phone already exists");
      }
    }

    const customer = await this.customerRepo.create({
      name: input.name,
      phone: input.phone || null,
      email: input.email || null,
      notes: input.notes || null,
      branchId: ctx.branchId,
      clientId: input.clientId,
    });

    return {
      ...customer,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }
}
