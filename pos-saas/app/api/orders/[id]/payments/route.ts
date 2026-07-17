import {
  withErrorHandler,
  parseBody,
  apiCreated,
} from "@/modules/shared";
import { requireWithBranchOrThrow } from "@/lib/permissions/check";
import { paymentSchema } from "@/lib/validations";
import { recordPaymentService } from "@/modules/orders/orders.module";
import type { RecordPaymentInput } from "@/modules/orders/application/dto";

export const POST = withErrorHandler(async (req, ctx) => {
  const permission = await requireWithBranchOrThrow("orders", "edit");
  const { id } = await ctx!.params;
  const input = await parseBody(req, paymentSchema);

  const result = await recordPaymentService.execute(
    id,
    input as RecordPaymentInput,
    permission,
  );

  return apiCreated(result.payment);
});
