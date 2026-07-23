# tickets

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/tickets` | bearer | — | TicketListEnvelope | List tickets for the current user or tenant |
| `POST` | `/tickets` | bearer | TenantTicketCreateInput | EnvelopeSuccess | Create a support ticket |
| `GET` | `/tickets/unread` | bearer | — | TicketUnreadEnvelope | Unread ticket events for the current user |
| `POST` | `/tickets/unread` | bearer | — | EnvelopeSuccess | Mark all ticket events as read |
| `GET` | `/tickets/{id}` | bearer | — | TenantTicketDetailEnvelope | Get a ticket with its comments |
| `POST` | `/tickets/{id}/comments` | bearer | TicketCommentInput | TicketCommentEnvelope | Add a tenant reply to a ticket |
| `POST` | `/tickets/{id}/csat` | bearer | TicketCsatInput | EnvelopeSuccess | Rate a resolved/closed ticket (CSAT) |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
