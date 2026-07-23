# customers

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/customers` | bearer | — | CustomerListEnvelope | List customers for the current tenant |
| `POST` | `/customers` | bearer | CustomerCreateInput | CustomerEnvelope | Create a customer |
| `GET` | `/customers/{id}` | bearer | — | CustomerDetailEnvelope | Get a customer by ID (with order/payment history) |
| `PATCH` | `/customers/{id}` | bearer | CustomerUpdateInput | CustomerEnvelope | Update customer fields |
| `DELETE` | `/customers/{id}` | bearer | — | — | Delete a customer |
| `GET` | `/customers/{id}/deposit` | bearer | — | CustomerDepositListEnvelope | List a customer's deposit transactions |
| `POST` | `/customers/{id}/deposit` | bearer | CustomerDepositTopUpInput | CustomerDepositEnvelope | Top up (or adjust) a customer's deposit balance |
| `GET` | `/customers/{id}/stats` | bearer | — | CustomerStatsEnvelope | Get a customer's order aggregates |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
