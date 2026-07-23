# tenant

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `PATCH` | `/tenant/onboarding` | bearer | TenantOnboardingInput | TenantProfileEnvelope | Complete tenant onboarding |
| `GET` | `/tenant/referral` | bearer | — | TenantReferralInfoEnvelope | Get the tenant referral code and usage stats |
| `GET` | `/tenant/website` | bearer | — | WebsiteConfigEnvelope | Get the tenant website configuration |
| `PATCH` | `/tenant/website` | bearer | WebsiteInput | WebsiteConfigEnvelope | Update tenant website settings |
| `DELETE` | `/tenant/website` | bearer | — | — | Disable the tenant website |
| `GET` | `/tenant/whatsapp-templates` | bearer | — | WhatsAppTemplatesEnvelope | Get WhatsApp message templates |
| `PATCH` | `/tenant/whatsapp-templates` | bearer | WhatsAppTemplates | WhatsAppTemplatesEnvelope | Override WhatsApp message templates |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
