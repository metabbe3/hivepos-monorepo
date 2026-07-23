# billing

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `POST` | `/billing/checkout` | bearer | CheckoutInput | CheckoutResult | Create a Midtrans Snap transaction for a plan purchase |
| `POST` | `/billing/promo/validate` | bearer | PromoValidateInput | PromoResult | Validate a promo code against a plan |
| `GET` | `/billing/status` | bearer | — | BillingStatus | Get the current tenant's billing/subscription status |
| `POST` | `/billing/webhook` | — | MidtransWebhookInput | EnvelopeSuccess | Midtrans payment notification webhook (PUBLIC, no auth) |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
