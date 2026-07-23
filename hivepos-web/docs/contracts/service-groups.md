# service-groups

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/service-groups` | bearer | — | ServiceGroupListEnvelope | List service groups for the current tenant |
| `POST` | `/service-groups` | bearer | ServiceGroupCreateInput | ServiceGroupEnvelope | Create a service group |
| `GET` | `/service-groups/{id}` | bearer | — | ServiceGroupEnvelope | Get a service group by ID |
| `PATCH` | `/service-groups/{id}` | bearer | ServiceGroupUpdateInput | ServiceGroupEnvelope | Update a service group |
| `DELETE` | `/service-groups/{id}` | bearer | — | — | Delete a service group |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
