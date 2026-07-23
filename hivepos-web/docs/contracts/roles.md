# roles

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/roles` | bearer | — | RoleListEnvelope | List roles for the current tenant |
| `POST` | `/roles` | bearer | RoleCreateInput | RoleEnvelope | Create a role |
| `GET` | `/roles/{id}` | bearer | — | RoleEnvelope | Get a role by ID |
| `PATCH` | `/roles/{id}` | bearer | RoleUpdateInput | OkEnvelope | Update role fields |
| `DELETE` | `/roles/{id}` | bearer | — | — | Delete a role |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
