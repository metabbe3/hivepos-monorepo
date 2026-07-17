import {
  isDevMode,
  createSnapTransaction,
  parseNotification,
  verifySignature,
  isSuccessfulStatus,
  isFailedStatus,
} from "@/lib/midtrans";
import type { MidtransPort } from "../domain/repository.port";
import type {
  SnapTransactionParams,
  SnapTransactionResult,
  MidtransNotification,
} from "../domain/types";

/**
 * Infrastructure adapter that wraps `lib/midtrans.ts`.
 *
 * Exposing Midtrans through this port means application services can be tested
 * with a fake gateway instead of monkey-patching module exports.
 */
export class MidtransAdapter implements MidtransPort {
  readonly isDevMode = isDevMode;

  async createSnapTransaction(
    params: SnapTransactionParams,
  ): Promise<SnapTransactionResult | null> {
    return createSnapTransaction(params);
  }

  parseNotification(body: unknown): MidtransNotification {
    return parseNotification(body);
  }

  verifySignature(notification: MidtransNotification): boolean {
    return verifySignature(notification);
  }

  isSuccessfulStatus(status: string): boolean {
    return isSuccessfulStatus(status);
  }

  isFailedStatus(status: string): boolean {
    return isFailedStatus(status);
  }
}
