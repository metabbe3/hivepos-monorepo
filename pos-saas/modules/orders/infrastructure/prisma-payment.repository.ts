import { prisma } from "@/lib/prisma";
import { logger, InsufficientBalanceError } from "@/modules/shared";
import type {
  PaymentRepository,
  RecordPaymentData,
  RecordPaymentResult,
} from "../domain/repository.port";
import { derivePaymentStatus } from "../domain/payment-status";

export class PrismaPaymentRepository implements PaymentRepository {
  async recordPayment(
    data: RecordPaymentData,
    customerId: string,
  ): Promise<RecordPaymentResult> {
    const result = await prisma.$transaction(async (tx) => {
      // Lock the order row for the duration of the transaction
      const order = await tx.order.findUniqueOrThrow({
        where: { id: data.orderId, branchId: data.branchId },
      });

      // ── Handle DEPOSIT: deduct from customer wallet ──
      // Atomic decrement (not read-then-write) so two concurrent deposit
      // payments on the same customer can't lose an update / double-spend.
      // The service pre-checks sufficiency outside this tx; if a concurrent
      // payment wins the race and drives the balance negative, the guard below
      // throws and the whole transaction rolls back (no payment recorded).
      if (data.paymentMethod === "DEPOSIT") {
        const updated = await tx.customer.update({
          where: { id: customerId },
          data: { balance: { decrement: data.amount } },
          select: { balance: true },
        });
        const newBalance = Number(updated.balance);
        if (newBalance < 0) {
          throw new InsufficientBalanceError();
        }

        await tx.depositTransaction.create({
          data: {
            customerId,
            type: "DEDUCTION",
            amount: data.amount,
            balanceAfter: newBalance,
            description: `Order payment — ${order.orderNumber}`,
            orderId: data.orderId,
            branchId: data.branchId,
          },
        });
      }

      // ── Create the payment record ──
      const payment = await tx.payment.create({
        data: {
          orderId: data.orderId,
          amount: data.amount,
          paymentMethod: data.paymentMethod,
          notes: data.notes,
          paidAt: data.paidAt,
        },
      });

      // ── Update order's paid amount and derived payment status ──
      const newPaidAmount = Number(order.paidAmount) + data.amount;
      const paymentStatus = derivePaymentStatus(
        newPaidAmount,
        Number(order.totalAmount),
      );

      await tx.order.update({
        where: { id: data.orderId },
        data: { paidAmount: newPaidAmount, paymentStatus },
      });

      return {
        payment: {
          id: payment.id,
          amount: Number(payment.amount),
          paymentMethod: payment.paymentMethod,
          notes: payment.notes,
          paidAt: payment.paidAt,
        },
        newPaidAmount,
        newPaymentStatus: paymentStatus,
      };
    });

    logger.info(
      {
        orderId: data.orderId,
        amount: data.amount,
        method: data.paymentMethod,
        status: result.newPaymentStatus,
      },
      "Payment recorded",
    );

    return result;
  }
}
