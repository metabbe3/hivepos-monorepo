# reports

> Source of truth: `contracts/openapi.yaml`. Generated — edit the YAML, not this file.

| Method | Path | Auth | Body | Response | Summary |
|---|---|---|---|---|---|
| `GET` | `/reports/attendance` | bearer | — | EnvelopeSuccess | Employee attendance report (paginated with date window meta) |
| `GET` | `/reports/commission` | bearer | — | ReportCommission | Commission report (revenue + commission by service) |
| `GET` | `/reports/customers` | bearer | — | ReportCustomers | Customers report (top spenders, outstanding balances) |
| `GET` | `/reports/expenses` | bearer | — | ReportExpenses | Expenses report (by category, daily trend) |
| `GET` | `/reports/export` | bearer | — | — | Export a report as a CSV file (field,value rows) |
| `GET` | `/reports/financial-statement` | bearer | — | ReportFinancialStatement | Consolidated financial statement report |
| `GET` | `/reports/inventory` | bearer | — | ReportInventory | Inventory report (stock levels + recent movements) |
| `GET` | `/reports/monthly-pnl` | bearer | — | ReportMonthlyPnL | Monthly profit & loss report (most complex report) |
| `GET` | `/reports/orders` | bearer | — | ReportOrders | Orders report (volume, turnaround, daily volume) |
| `GET` | `/reports/outstanding` | bearer | — | ReportOutstanding | Outstanding balances report (per-customer unpaid orders) |
| `GET` | `/reports/payment-collection` | bearer | — | ReportPaymentCollection | Payment collection report (collected vs unpaid, by month) |
| `GET` | `/reports/piutang-tracker` | bearer | — | ReportPiutang | Piutang (receivables) tracker report (aging buckets, monthly summary) |
| `GET` | `/reports/profit` | bearer | — | ReportProfit | Profit report (summary + daily comparison) |
| `GET` | `/reports/revenue` | bearer | — | ReportRevenue | Revenue report (gross/net, by method, daily trend) |
| `GET` | `/reports/services` | bearer | — | ReportServices | Services report (per-service usage and revenue) |

## Schemas

See `contracts/openapi.yaml` `components.schemas` for full field definitions. Types: `lib/api/types.ts`.
