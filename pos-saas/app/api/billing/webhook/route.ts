import { withErrorHandler, apiSuccess } from "@/modules/shared";
import { handleWebhookService } from "@/modules/billing/billing.module";

export const POST = withErrorHandler(async (req) => {
  const body = await req.json();
  const result = await handleWebhookService.execute(body);
  return apiSuccess(result);
});
