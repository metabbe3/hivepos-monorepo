import { NotFoundError, BusinessRuleError } from "@/modules/shared";
import { parseDateRange } from "@/lib/dates";
import type { CustomerRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { UpdateCustomerInput, CustomerDateRangeInput, CustomerDetailDTO } from "./dto";

// ── Get Customer Detail ────────────────────────────────────────────────

export class GetCustomerService {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(id: string, dateRange: CustomerDateRangeInput, ctx: RequestContext): Promise<CustomerDetailDTO> {
    const range = parseDateRange(dateRange);
    const customer = await this.customerRepo.findById(id, ctx.branchId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    // Filter orders by date range if provided
    let orders = customer.orders;
    if (range.from || range.to) {
      orders = orders.filter((o) => {
        if (range.from && o.createdAt < range.from!) return false;
        if (range.to && o.createdAt > range.to!) return false;
        return true;
      });
    }

    return {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      notes: customer.notes,
      balance: customer.balance,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        totalAmount: o.totalAmount,
        paidAmount: o.paidAmount,
        createdAt: o.createdAt.toISOString(),
        itemCount: o.orderItems.length,
        payments: o.payments.map((p) => ({
          id: p.id,
          amount: p.amount,
          paymentMethod: p.paymentMethod,
          createdAt: p.createdAt.toISOString(),
        })),
      })),
    };
  }
}

// ── Update Customer ────────────────────────────────────────────────────

export class UpdateCustomerService {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(id: string, input: UpdateCustomerInput, ctx: RequestContext) {
    const customer = await this.customerRepo.update(id, ctx.branchId, {
      name: input.name,
      phone: input.phone,
      email: input.email,
      notes: input.notes,
    });

    return {
      ...customer,
      createdAt: customer.createdAt.toISOString(),
      updatedAt: customer.updatedAt.toISOString(),
    };
  }
}

// ── Delete Customer ────────────────────────────────────────────────────

export class DeleteCustomerService {
  constructor(private customerRepo: CustomerRepository) {}

  async execute(id: string, ctx: RequestContext): Promise<void> {
    const orderCount = await this.customerRepo.countOrders(id, ctx.branchId);
    if (orderCount > 0) {
      throw new BusinessRuleError(
        "Cannot delete customer with existing orders. Consider deactivating instead.",
      );
    }

    await this.customerRepo.delete(id, ctx.branchId);
  }
}
