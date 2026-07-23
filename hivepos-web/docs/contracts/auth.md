# auth

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/auth/callback/google` | — | — | — | Google OAuth callback (exchange code, mint JWT, redirect) |
| `GET` | `/auth/google` | — | — | — | Start Google OAuth (redirect to consent screen) |
| `POST` | `/auth/google/link` | bearer | — | GoogleOAuthLinkEnvelope | Start linking Google to the logged-in user |
| `DELETE` | `/auth/google/unlink` | bearer | — | OkEnvelope | Remove the Google link from the logged-in user |
| `POST` | `/auth/login` | — | LoginInput | LoginResponseEnvelope | Email + password login → JWT |
| `POST` | `/auth/logout` | bearer | — | OkEnvelope | Clear all session cookies |
| `GET` | `/auth/me` | bearer | — | MeEnvelope | Current user + resolved claims |
| `GET` | `/auth/session-version` | bearer | — | SessionVersionEnvelope | Get the caller's current session version |
| `POST` | `/auth/session-version` | bearer | — | SessionVersionEnvelope | Bump session version (force token refresh) |
| `POST` | `/register` | — | RegisterInput | LoginResponseEnvelope | Register a new tenant + owner, mint JWT |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
