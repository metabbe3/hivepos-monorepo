# expenses

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/expense-categories` | bearer | — | ExpenseCategoryListEnvelope | List expense categories for the current tenant |
| `POST` | `/expense-categories` | bearer | ExpenseCategoryCreateInput | ExpenseCategoryEnvelope | Create an expense category |
| `PATCH` | `/expense-categories/{id}` | bearer | ExpenseCategoryUpdateInput | ExpenseCategoryEnvelope | Update an expense category |
| `DELETE` | `/expense-categories/{id}` | bearer | — | — | Delete an expense category |
| `GET` | `/expenses` | bearer | — | ExpenseListEnvelope | List expenses for the current tenant |
| `POST` | `/expenses` | bearer | ExpenseCreateInput | ExpenseEnvelope | Create an expense |
| `GET` | `/expenses/{id}` | bearer | — | ExpenseEnvelope | Get an expense by ID |
| `PATCH` | `/expenses/{id}` | bearer | ExpenseUpdateInput | ExpenseEnvelope | Update expense fields |
| `DELETE` | `/expenses/{id}` | bearer | — | — | Delete an expense |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
