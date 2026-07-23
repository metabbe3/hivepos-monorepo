# public

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/public/blog-posts` | — | — | BlogPostListEnvelope | List published blog posts |
| `GET` | `/public/blog-posts/{slug}` | — | — | BlogPostEnvelope | Get a single published blog post by slug |
| `GET` | `/public/branches` | — | — | EnvelopeSuccess | Public branch directory for a tenant |
| `GET` | `/public/orders/track` | — | — | OrderTrackingEnvelope | Track a public order by order number |
| `POST` | `/public/pickup-requests` | — | PublicPickupInput | PublicPickupResultEnvelope | Submit a public pickup request |
| `GET` | `/public/services` | — | — | PublicServiceCatalogEnvelope | Public service catalog for a tenant |
| `GET` | `/public/tenants/{slug}` | — | — | PublicTenantEnvelope | Public tenant website payload by slug |
| `POST` | `/public/tickets` | — | PublicTicketInput | PublicTicketResultEnvelope | Submit a public support ticket |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
