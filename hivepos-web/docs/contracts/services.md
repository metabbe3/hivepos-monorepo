# services

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/services` | bearer | — | ServiceListEnvelope | List services for the current tenant |
| `POST` | `/services` | bearer | ServiceCreateInput | ServiceEnvelope | Create a service |
| `GET` | `/services/{id}` | bearer | — | ServiceEnvelope | Get a service by ID |
| `PATCH` | `/services/{id}` | bearer | ServiceUpdateInput | ServiceEnvelope | Update service fields |
| `DELETE` | `/services/{id}` | bearer | — | — | Delete a service |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
