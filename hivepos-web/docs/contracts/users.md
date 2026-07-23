# users

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/users` | bearer | — | StaffUserListEnvelope | List staff users for the current tenant |
| `POST` | `/users` | bearer | StaffUserCreateInput | StaffUserEnvelope | Create a staff user |
| `GET` | `/users/{id}` | bearer | — | StaffUserEnvelope | Get a staff user by ID |
| `PATCH` | `/users/{id}` | bearer | StaffUserUpdateInput | OkEnvelope | Update staff user fields |
| `DELETE` | `/users/{id}` | bearer | — | — | Delete a staff user |
| `PATCH` | `/users/{id}/pin` | bearer | StaffUserSetPinInput | OkEnvelope | Set (or reset) a staff user's PIN |
| `POST` | `/users/{id}/reset-password` | bearer | — | StaffUserResetPasswordEnvelope | Generate a one-time temp password for a staff user |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
