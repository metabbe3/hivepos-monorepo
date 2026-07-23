# pickup

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/pickup-requests` | bearer | — | PickupRequestListEnvelope | List pickup requests for the current tenant |
| `POST` | `/pickup-requests` | bearer | PickupRequestCreateInput | PickupRequestEnvelope | Create a pickup request |
| `GET` | `/pickup-requests/count-pending` | bearer | — | PickupPendingCountEnvelope | Count pending pickup requests |
| `GET` | `/pickup-requests/{id}` | bearer | — | PickupRequestEnvelope | Get a pickup request by id |
| `POST` | `/pickup-requests/{id}/accept` | bearer | — | PickupStatusOkEnvelope | Accept a pending pickup request |
| `POST` | `/pickup-requests/{id}/assign` | bearer | PickupTransitionInput | PickupStatusOkEnvelope | Assign a pickup request to a driver/staff |
| `POST` | `/pickup-requests/{id}/convert` | bearer | PickupTransitionInput | PickupStatusOkEnvelope | Convert a pickup request into an order |
| `POST` | `/pickup-requests/{id}/reject` | bearer | PickupTransitionInput | PickupStatusOkEnvelope | Reject a pickup request |
| `POST` | `/pickup-requests/{id}/schedule` | bearer | PickupTransitionInput | PickupStatusOkEnvelope | Schedule a pickup request |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
