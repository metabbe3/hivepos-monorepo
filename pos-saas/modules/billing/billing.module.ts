import { PrismaBillingRepository } from "./infrastructure/prisma-billing.repository";
import { MidtransAdapter } from "./infrastructure/midtrans.port";
import { GetBillingStatusService } from "./application/billing-status.service";
import { CreateCheckoutService } from "./application/create-checkout.service";
import { ValidatePromoService } from "./application/validate-promo.service";
import { HandleWebhookService } from "./application/handle-webhook.service";

// ── Infrastructure singletons ──────────────────────────────────────────
const billingRepo = new PrismaBillingRepository();
const midtransPort = new MidtransAdapter();

// ── Application service singletons ─────────────────────────────────────
export const getBillingStatusService = new GetBillingStatusService(billingRepo);
export const createCheckoutService = new CreateCheckoutService(
  billingRepo,
  midtransPort,
);
export const validatePromoService = new ValidatePromoService(billingRepo);
export const handleWebhookService = new HandleWebhookService(
  billingRepo,
  midtransPort,
);
