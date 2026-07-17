import { NotFoundError, ValidationError } from "@/modules/shared";
import type { DepositRepository, CustomerRepository } from "../domain/repository.port";
import type { RequestContext } from "./context";
import type { TopUpInput, DepositTransactionDTO } from "./dto";

export class TopUpDepositService {
  constructor(
    private depositRepo: DepositRepository,
    private customerRepo: CustomerRepository,
  ) {}

  async execute(
    customerId: string,
    input: TopUpInput,
    ctx: RequestContext,
  ): Promise<DepositTransactionDTO> {
    if (input.amount <= 0) {
      throw new ValidationError("Jumlah top-up harus lebih dari 0.");
    }

    // Verify customer exists within branch
    const customer = await this.customerRepo.findById(customerId, ctx.branchId);
    if (!customer) {
      throw new NotFoundError("Customer not found");
    }

    const txn = await this.depositRepo.topUp({
      customerId,
      branchId: ctx.branchId,
      amount: input.amount,
      description: input.description,
      notes: input.notes,
    });

    return {
      id: txn.id,
      customerId: txn.customerId,
      type: txn.type,
      amount: txn.amount,
      balanceAfter: txn.balanceAfter,
      orderId: txn.orderId,
      description: txn.description,
      notes: txn.notes,
      createdAt: txn.createdAt.toISOString(),
    };
  }
}

export class ListDepositTransactionsService {
  constructor(private depositRepo: DepositRepository) {}

  async execute(customerId: string, ctx: RequestContext): Promise<DepositTransactionDTO[]> {
    const transactions = await this.depositRepo.listTransactions(customerId, 50);
    return transactions.map((t) => ({
      id: t.id,
      customerId: t.customerId,
      type: t.type,
      amount: t.amount,
      balanceAfter: t.balanceAfter,
      orderId: t.orderId,
      description: t.description,
      notes: t.notes,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}
