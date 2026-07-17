# auth

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `POST` | `/auth/login` | — | LoginInput | LoginResponseEnvelope | Email + password login → JWT |
| `POST` | `/register` | — | RegisterInput | LoginResponseEnvelope | Register a new tenant + owner, mint JWT |
| `GET` | `/auth/me` | bearer | — | MeEnvelope | Current user + resolved claims |
| `POST` | `/auth/session-version` | bearer | — | SessionVersionEnvelope | Bump session version (force token refresh) |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
