# account

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/onboarding/status` | bearer | — | OnboardingStatusEnvelope | Onboarding setup progress for the caller's tenant |
| `GET` | `/user` | bearer | — | AccountUserEnvelope | Lightweight current-user context |
| `GET` | `/user/profile` | bearer | — | UserProfileEnvelope | Get the current user's editable profile |
| `PATCH` | `/user/profile` | bearer | UpdateProfileInput | UserProfileEnvelope | Update name/phone and/or change password |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
