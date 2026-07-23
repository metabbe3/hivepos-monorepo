# attendance

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `POST` | `/attendance/clock` | bearer | ClockRequest | AttendanceEventEnvelope | Toggle a clock-in/out event |
| `GET` | `/attendance/events` | bearer | — | AttendanceEventListEnvelope | List clock events |
| `POST` | `/attendance/events` | bearer | CreateEventRequest | AttendanceEventEnvelope | Manually create a clock event |
| `PATCH` | `/attendance/events/{id}` | bearer | UpdateEventRequest | OkEnvelope | Update a clock event |
| `DELETE` | `/attendance/events/{id}` | bearer | — | — | Delete a clock event |
| `POST` | `/attendance/quick-staff` | bearer | QuickStaffRequest | StaffItemEnvelope | Create an attendance-only staff member |
| `GET` | `/attendance/staff` | bearer | — | StaffItemListEnvelope | List staff eligible to clock |
| `GET` | `/attendance/status` | bearer | — | AttendanceStatusListEnvelope | List who is currently clocked in |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
