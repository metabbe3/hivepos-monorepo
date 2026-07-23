# branches

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/branches` | bearer | — | BranchListEnvelope | List branches for the active tenant |
| `POST` | `/branches` | bearer | CreateBranchInput | BranchEnvelope | Create a branch (outlet) for the active tenant |
| `GET` | `/branches/{id}` | bearer | — | BranchEnvelope | Get a branch by ID |
| `PATCH` | `/branches/{id}` | bearer | UpdateBranchInput | BranchEnvelope | Update a branch |
| `DELETE` | `/branches/{id}` | bearer | — | — | Delete a branch |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
