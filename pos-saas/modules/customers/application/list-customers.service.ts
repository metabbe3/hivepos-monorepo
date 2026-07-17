import type { CustomerRepository, CustomerWithSummary } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { ListCustomersInput, CustomerListDTO } from "./dto";
import type { CustomerStatus } from "../domain/types";

export class ListCustomersService {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(input: ListCustomersInput, ctx: RequestContext): Promise<CustomerListDTO[]> {
    const records = await this.customerRepo.findMany({
      branchId: ctx.branchId,
      search: input.search || undefined,
      sort: input.sort || "createdAt",
      order: input.order || "desc",
    });

    const statusFilter = input.status || "";
    const filtered = statusFilter
      ? records.filter((r) => r.customerStatus === (statusFilter as CustomerStatus))
      : records;

    return filtered.map(toDTO);
  }
}

function toDTO(r: CustomerWithSummary): CustomerListDTO {
  return {
    id: r.id,
    name: r.name,
    phone: r.phone,
    email: r.email,
    notes: r.notes,
    balance: r.balance,
    createdAt: r.createdAt.toISOString(),
    totalOrders: r.totalOrders,
    totalSpent: r.totalSpent,
    lastOrderDate: r.lastOrderDate ? r.lastOrderDate.toISOString() : null,
    customerStatus: r.customerStatus,
  };
}
