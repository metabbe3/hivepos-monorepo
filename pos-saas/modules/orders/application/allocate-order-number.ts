import { generateOrderNumber } from "../domain/order-number.vo";

const MAX_ATTEMPTS = 5;

// ponytail: structural guard — same shape as error-mapper.ts:21-29.
// Avoids importing Prisma directly into the application layer.
function isUniqueConstraintViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code: string }).code === "P2002"
  );
}

/**
 * Allocate a unique order number under contention by retrying on P2002.
 *
 * Two concurrent calls into CreateOrderService (e.g. a manual order-create
 * racing a pickup-confirm) can read the same `getLastSequenceForPrefix`
 * value and compute the same candidate number. The loser's INSERT trips
 * the `Order.orderNumber @unique` constraint (Prisma P2002). We re-read the
 * sequence and try again — by the second attempt the winner's row is
 * visible and the next number is free.
 *
 * Ceiling: handles up to MAX_ATTEMPTS-1 concurrent racers for the same
 * (tenant, day) prefix. A laundry POS will never hit this; if it ever
 * does, switch to a counter table.
 */
export async function allocateOrderNumber<T>(
  prefix: string,
  receivedAt: Date,
  tenantCode: string,
  getLastSequence: (prefix: string) => Promise<number>,
  tryInsert: (orderNumber: string) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const lastSeq = await getLastSequence(prefix);
    const candidate = generateOrderNumber(receivedAt, lastSeq, tenantCode);
    try {
      return await tryInsert(candidate);
    } catch (err) {
      if (isUniqueConstraintViolation(err) && attempt < MAX_ATTEMPTS) continue;
      throw err;
    }
  }
  // ponytail: unreachable — loop either returns or re-throws on the final attempt.
  throw new Error("allocateOrderNumber: exhausted retries");
}
