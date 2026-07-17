import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/modules/shared";
import { decimalToNumberRequired } from "@/modules/shared/serialization";
import type {
  DepositRepository,
  DepositTransactionRecord,
  TopUpData,
} from "../domain/repository.port";

export class PrismaDepositRepository implements DepositRepository {
  async listTransactions(customerId: string, limit = 50): Promise<DepositTransactionRecord[]> {
    const transactions = await prisma.depositTransaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return transactions.map((t) => ({
      id: t.id,
      customerId: t.customerId,
      branchId: t.branchId,
      type: t.type,
      amount: decimalToNumberRequired(t.amount),
      balanceAfter: decimalToNumberRequired(t.balanceAfter),
      orderId: t.orderId,
      description: t.description,
      notes: t.notes,
      createdAt: t.createdAt,
    }));
  }

  async topUp(data: TopUpData): Promise<DepositTransactionRecord> {
    const result = await prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({
        where: { id: data.customerId, branchId: data.branchId },
      });

      if (!customer) {
        throw new NotFoundError("Customer not found");
      }

      const newBalance = decimalToNumberRequired(customer.balance) + data.amount;

      const transaction = await tx.depositTransaction.create({
        data: {
          customerId: data.customerId,
          type: "TOP_UP",
          amount: data.amount,
          balanceAfter: newBalance,
          description: data.description,
          notes: data.notes,
          branchId: data.branchId,
        },
      });

      await tx.customer.update({
        where: { id: data.customerId },
        data: { balance: newBalance },
      });

      return transaction;
    });

    return {
      id: result.id,
      customerId: result.customerId,
      branchId: result.branchId,
      type: result.type,
      amount: decimalToNumberRequired(result.amount),
      balanceAfter: decimalToNumberRequired(result.balanceAfter),
      orderId: result.orderId,
      description: result.description,
      notes: result.notes,
      createdAt: result.createdAt,
    };
  }
}
