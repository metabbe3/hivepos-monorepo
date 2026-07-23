# inventory

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/stock-items` | bearer | — | StockItemListEnvelope | List stock items for the active branch/tenant |
| `POST` | `/stock-items` | bearer | CreateStockItemInput | StockItemEnvelope | Create a stock item in the active branch |
| `PATCH` | `/stock-items/{id}` | bearer | UpdateStockItemInput | StockItemEnvelope | Update a stock item |
| `DELETE` | `/stock-items/{id}` | bearer | — | — | Delete a stock item |
| `GET` | `/stock-items/{id}/movements` | bearer | — | StockMovementListEnvelope | List movements for a stock item |
| `POST` | `/stock-items/{id}/movements` | bearer | CreateStockMovementInput | StockMovementEnvelope | Record a stock movement (IN / OUT / ADJUSTMENT) |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
