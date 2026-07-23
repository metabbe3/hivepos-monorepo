# super-admin

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/super-admin/admins` | bearer | — | EnvelopeSuccess | List platform-staff (SuperAdmin) accounts. |
| `POST` | `/super-admin/admins` | bearer | SuperAdminAdminInput | SuperAdminAdmin | Create a platform-staff account. |
| `PATCH` | `/super-admin/admins/{id}` | bearer | — | EnvelopeSuccess | Update a platform-staff account's role. |
| `DELETE` | `/super-admin/admins/{id}` | bearer | — | EnvelopeSuccess | Delete a platform-staff account (hard delete). |
| `GET` | `/super-admin/ai/chat` | bearer | — | AiChatConfigEnvelope | Get AI assistant config |
| `POST` | `/super-admin/ai/chat` | bearer | SuperAdminAiChatInput | — | Chat with the AI assistant (SSE stream) |
| `GET` | `/super-admin/audit-log` | bearer | — | SuperAdminAuditLogListEnvelope | List audit log entries (paginated, bare array + meta) |
| `GET` | `/super-admin/billing/overview` | bearer | — | BillingOverview | Cross-tenant billing overview (MRR, revenue, paid outlets, failures). |
| `GET` | `/super-admin/billing/payments` | bearer | — | SuperAdminPaymentRowsEnvelope | List cross-tenant SaaS payments (paginated, writeRows) |
| `POST` | `/super-admin/billing/payments/{id}/refund` | bearer | — | SuperAdminPaymentEnvelope | Refund a payment (marks status REFUNDED) |
| `GET` | `/super-admin/blog` | bearer | — | SuperAdminBlogPostListEnvelope | List blog posts (paginated, bare array + meta) |
| `POST` | `/super-admin/blog` | bearer | SuperAdminBlogPostInput | SuperAdminBlogPostEnvelope | Create a blog post |
| `GET` | `/super-admin/blog/{id}` | bearer | — | SuperAdminBlogPostEnvelope | Get a blog post |
| `PATCH` | `/super-admin/blog/{id}` | bearer | SuperAdminBlogPostInput | SuperAdminBlogPostEnvelope | Update a blog post |
| `DELETE` | `/super-admin/blog/{id}` | bearer | — | — | Delete a blog post |
| `GET` | `/super-admin/error-logs` | bearer | — | SuperAdminErrorLogRowsEnvelope | List error logs (paginated, writeRows) |
| `POST` | `/super-admin/error-logs/{id}/resolve` | bearer | — | SuperAdminErrorLogResolveEnvelope | Mark an error log resolved |
| `DELETE` | `/super-admin/error-logs/{id}/resolve` | bearer | — | SuperAdminErrorLogResolveEnvelope | Reopen an error log (un-resolve) |
| `GET` | `/super-admin/feature-flags` | bearer | — | SuperAdminFeatureFlagListEnvelope | List all feature flags (bare array) |
| `POST` | `/super-admin/feature-flags` | bearer | SuperAdminFeatureFlagInput | SuperAdminFeatureFlagEnvelope | Create a feature flag |
| `GET` | `/super-admin/feature-flags/{id}` | bearer | — | SuperAdminFeatureFlagDetailEnvelope | Get a feature flag (with per-tenant overrides) |
| `PATCH` | `/super-admin/feature-flags/{id}` | bearer | SuperAdminFeatureFlagInput | SuperAdminFeatureFlagEnvelope | Update a feature flag |
| `DELETE` | `/super-admin/feature-flags/{id}` | bearer | — | — | Delete a feature flag |
| `GET` | `/super-admin/feature-flags/{id}/tenants` | bearer | — | SuperAdminTenantFlagListEnvelope | List per-tenant overrides for a feature flag (bare array) |
| `POST` | `/super-admin/feature-flags/{id}/tenants` | bearer | SuperAdminTenantFlagInput | SuperAdminTenantFlagEnvelope | Upsert a tenant feature-flag override |
| `DELETE` | `/super-admin/feature-flags/{id}/tenants/{tenantId}` | bearer | — | — | Delete a tenant feature-flag override |
| `POST` | `/super-admin/impersonate` | bearer | — | EnvelopeSuccess | Start impersonating a tenant or user; returns an impersonation token. |
| `POST` | `/super-admin/impersonate/stop` | bearer | — | EnvelopeSuccess | Log the stop of an impersonation (audit trail; stateless JWT). |
| `POST` | `/super-admin/me/password` | bearer | — | — | Update the calling super-admin's own password. |
| `POST` | `/super-admin/me/sessions` | bearer | — | — | Revoke all other sessions for the calling super-admin. |
| `GET` | `/super-admin/performance` | bearer | — | EnvelopeSuccess | Cross-tenant performance rows (revenue, order volume, trial health). |
| `GET` | `/super-admin/pickup-insights` | bearer | — | PickupInsights | Cross-tenant pickup-request rejection analytics. |
| `GET` | `/super-admin/plans` | bearer | — | SuperAdminPlanListEnvelope | List all subscription plans (bare array) |
| `POST` | `/super-admin/plans` | bearer | SuperAdminPlanInput | SuperAdminPlanEnvelope | Create a subscription plan |
| `PATCH` | `/super-admin/plans/{id}` | bearer | SuperAdminPlanInput | SuperAdminPlanEnvelope | Update a plan (partial) |
| `DELETE` | `/super-admin/plans/{id}` | bearer | — | — | Delete a plan |
| `GET` | `/super-admin/promo-codes` | bearer | — | SuperAdminPromoCodeListEnvelope | List promo codes (paginated, bare array + meta) |
| `POST` | `/super-admin/promo-codes` | bearer | SuperAdminPromoCodeInput | SuperAdminPromoCodeEnvelope | Create a promo code |
| `PATCH` | `/super-admin/promo-codes/{id}` | bearer | SuperAdminPromoCodeInput | SuperAdminPromoCodeEnvelope | Update a promo code (partial) |
| `DELETE` | `/super-admin/promo-codes/{id}` | bearer | — | — | Delete a promo code |
| `POST` | `/super-admin/pwa/force-update` | bearer | — | SuperAdminPwaForceUpdateEnvelope | Force a PWA cache-bust across clients |
| `GET` | `/super-admin/referrals` | bearer | — | SuperAdminReferralListEnvelope | List referrals (paginated, bare array + meta) |
| `PATCH` | `/super-admin/referrals/{id}` | bearer | SuperAdminReferralUpdateInput | SuperAdminReferralEnvelope | Update a referral status (REWARDED / REJECTED / etc.) |
| `GET` | `/super-admin/stats` | bearer | — | SuperAdminStats | Platform headline stats (tenant/user counts, MRR, trial health). |
| `GET` | `/super-admin/tenants` | bearer | — | EnvelopeSuccess | List tenants (paginated). |
| `GET` | `/super-admin/tenants/{id}` | bearer | — | SuperAdminTenantDetail | Get a single tenant plus its plans + subscription (composite). |
| `PATCH` | `/super-admin/tenants/{id}` | bearer | SuperAdminTenantInput | SuperAdminTenant | Update tenant fields. |
| `POST` | `/super-admin/tenants/{id}/approve` | bearer | — | SuperAdminTenant | Approve a pending tenant. |
| `GET` | `/super-admin/tenants/{id}/billing` | bearer | — | SuperAdminTenantBilling | Get a tenant's subscription + recent payments. |
| `PATCH` | `/super-admin/tenants/{id}/subscription` | bearer | SuperAdminSubscriptionInput | SuperAdminSubscription | Update a tenant's subscription (plan, status, or extend trial). |
| `POST` | `/super-admin/tenants/{id}/suspend` | bearer | — | SuperAdminTenant | Suspend a tenant. |
| `DELETE` | `/super-admin/tenants/{id}/suspend` | bearer | — | SuperAdminTenant | Reactivate a suspended tenant. |
| `PATCH` | `/super-admin/tenants/{id}/whatsapp` | bearer | — | EnvelopeSuccess | Toggle the tenant's settings.whatsappEnabled flag. |
| `GET` | `/super-admin/tickets` | bearer | — | SuperAdminTicketRowsEnvelope | List support tickets (paginated, writeRows) |
| `GET` | `/super-admin/tickets/{id}` | bearer | — | SuperAdminTicketDetailEnvelope | Get a support ticket with its comment thread |
| `POST` | `/super-admin/tickets/{id}/comments` | bearer | SuperAdminCommentInput | SuperAdminTicketCommentEnvelope | Add a comment to a ticket |
| `POST` | `/super-admin/tickets/{id}/priority` | bearer | SuperAdminTicketPriorityInput | SuperAdminTicketEnvelope | Update a ticket's priority |
| `POST` | `/super-admin/tickets/{id}/status` | bearer | SuperAdminTicketStatusInput | SuperAdminTicketEnvelope | Update a ticket's status |
| `GET` | `/super-admin/users` | bearer | — | EnvelopeSuccess | List platform users across tenants (paginated). |
| `POST` | `/super-admin/users/{id}/reset-password` | bearer | — | EnvelopeSuccess | Reset a user's password; returns a temporary password. |
| `POST` | `/super-admin/users/{id}/suspend` | bearer | — | SuperAdminUser | Suspend a user. |
| `DELETE` | `/super-admin/users/{id}/suspend` | bearer | — | SuperAdminUser | Reactivate a suspended user. |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
