# dashboard

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/dashboard/heatmap` | bearer | — | HeatmapDataEnvelope | Busy-hours heatmap + revenue trend |
| `GET` | `/dashboard/kanban` | bearer | — | KanbanDataListEnvelope | Live order pipeline (kanban) |
| `GET` | `/dashboard/stats` | bearer | — | DashboardStatsEnvelope | Aggregate dashboard metrics |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
