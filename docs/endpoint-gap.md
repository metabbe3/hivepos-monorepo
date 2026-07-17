# Endpoint Gap: pos-saas (TS) → hivepos-api (Go)

**TS total: 138 endpoints. Go total: 138 — all ported (git `77a8a99`).**

> The status columns below (🔲/❌) predate the port and are no longer accurate;
> all 138 are implemented. For response-level parity status and open gaps, see
> [`parity-report.md`](./parity-report.md).

## Status Legend
- ✅ Done — endpoint implemented in Go
- 🔲 Scaffolded — module directory exists, no routes
- ❌ Not started — no Go code

## Core Operations

| TS Endpoint | Method | Go Status |
|---|---|---|
| `/api/orders` | GET, POST | 🔲 module exists |
| `/api/orders/[id]` | GET, PATCH, PUT, DELETE | ❌ |
| `/api/orders/[id]/status` | POST | ❌ |
| `/api/orders/[id]/payments` | POST | ❌ |

## Customer Management

| TS Endpoint | Method | Go Status |
|---|---|---|
| `/api/customers` | GET, POST | 🔲 module exists |
| `/api/customers/[id]` | GET, PATCH, DELETE | ❌ |
| `/api/customers/[id]/stats` | GET | ❌ |
| `/api/customers/[id]/deposit` | GET, POST | ❌ |
| `/api/customers/import` | POST | ❌ |

## Service Catalog

| TS Endpoint | Method | Go Status |
|---|---|---|
| `/api/services` | GET, POST | 🔲 module exists |
| `/api/services/[id]` | GET, PATCH, DELETE | ❌ |
| `/api/service-groups` | GET, POST | ❌ |
| `/api/service-groups/[id]` | GET, PATCH, DELETE | ❌ |

## Inventory & Expenses

| TS Endpoint | Method | Go Status |
|---|---|---|
| `/api/stock-items` | GET, POST | 🔲 module exists |
| `/api/stock-items/[id]` | PATCH, DELETE | ❌ |
| `/api/stock-items/[id]/movements` | GET, POST | ❌ |
| `/api/expenses` | GET, POST | 🔲 module exists |
| `/api/expense-categories` | GET, POST | ❌ |
| `/api/expense-categories/[id]` | PATCH, DELETE | ❌ |

## Branch & User Management

| TS Endpoint | Method | Go Status |
|---|---|---|
| `/api/branches` | GET, POST | 🔲 module exists |
| `/api/branches/[id]` | GET, PATCH, DELETE | ❌ |
| `/api/users` | GET, POST | 🔲 module exists |
| `/api/users/[id]` | GET, PATCH, DELETE | ❌ |
| `/api/users/[id]/pin` | PATCH | ❌ |
| `/api/roles` | GET, POST | ❌ |
| `/api/roles/[id]` | GET, PATCH, DELETE | ❌ |

## Pickup Requests

| TS Endpoint | Method | Go Status |
|---|---|---|
| `/api/pickup-requests` | GET, POST | 🔲 module exists |
| `/api/pickup-requests/[id]` | GET | ❌ |
| `/api/pickup-requests/[id]/accept` | POST | ❌ |
| `/api/pickup-requests/[id]/reject` | POST | ❌ |
| `/api/pickup-requests/[id]/schedule` | POST | ❌ |
| `/api/pickup-requests/[id]/assign` | POST | ❌ |
| `/api/pickup-requests/[id]/convert` | POST | ❌ |
| `/api/pickup-requests/count-pending` | GET | ❌ |

## Attendance

| TS Endpoint | Method | Go Status |
|---|---|---|
| `/api/attendance/staff` | GET | 🔲 module exists |
| `/api/attendance/status` | GET | ❌ |
| `/api/attendance/clock` | POST | ❌ |
| `/api/attendance/events` | GET, POST | ❌ |
| `/api/attendance/quick-staff` | POST | ❌ |
| `/api/attendance/events/[id]` | PATCH, DELETE | ❌ |

## Reports (15 endpoints)

| TS Endpoint | Go Status |
|---|---|
| `/api/reports/orders` | 🔲 module exists |
| `/api/reports/revenue` | ❌ |
| `/api/reports/services` | ❌ |
| `/api/reports/customers` | ❌ |
| `/api/reports/expenses` | ❌ |
| `/api/reports/monthly-pnl` | ❌ |
| `/api/reports/profit` | ❌ |
| `/api/reports/outstanding` | ❌ |
| `/api/reports/payment-collection` | ❌ |
| `/api/reports/commission` | ❌ |
| `/api/reports/attendance` | ❌ |
| `/api/reports/inventory` | ❌ |
| `/api/reports/piutang-tracker` | ❌ |
| `/api/reports/financial-statement` | ❌ |
| `/api/reports/export` | ❌ |

## Dashboard & Billing

| TS Endpoint | Go Status |
|---|---|
| `/api/dashboard/stats` | 🔲 module exists |
| `/api/dashboard/kanban` | ❌ |
| `/api/dashboard/heatmap` | ❌ |
| `/api/billing/status` | 🔲 module exists |
| `/api/billing/checkout` | ❌ |
| `/api/billing/webhook` | ❌ |
| `/api/billing/promo/validate` | ❌ |

## Auth & Public

| TS Endpoint | Go Status |
|---|---|
| `/api/auth/[...nextauth]` | 🔲 module exists |
| `/api/auth/login` | ❌ |
| `/api/register` | ❌ |
| `/api/health` | ✅ **DONE** |
| `/api/pwa/nonce` | ❌ |

## Super-Admin (50+ endpoints)

| TS Endpoint | Go Status |
|---|---|
| `/api/super-admin/stats` | 🔲 module exists |
| `/api/super-admin/tenants/*` | ❌ |
| `/api/super-admin/users/*` | ❌ |
| `/api/super-admin/billing/*` | ❌ |
| `/api/super-admin/feature-flags/*` | ❌ |
| `/api/super-admin/blog/*` | ❌ |
| `/api/super-admin/tickets/*` | ❌ |
| `/api/super-admin/error-logs/*` | ❌ |

## Summary

| Domain | TS Endpoints | Go Status |
|---|---|---|
| Orders | 8 | 🔲 scaffold |
| Customers | 8 | 🔲 scaffold |
| Services + Groups | 9 | 🔲 scaffold |
| Inventory + Expenses | 10 | 🔲 scaffold |
| Branches + Users + Roles | 12 | 🔲 scaffold |
| Pickup | 8 | 🔲 scaffold |
| Attendance | 7 | 🔲 scaffold |
| Reports | 15 | 🔲 scaffold |
| Dashboard | 3 | 🔲 scaffold |
| Billing | 4 | 🔲 scaffold |
| Auth + Public | 5 | 🔲 scaffold |
| Super-Admin | ~50 | 🔲 scaffold |
| Health | 1 | ✅ done |
| **Total** | **~138** | **1 done, ~137 to port** |

## Migration Priority

1. **P0 (critical path):** Orders CRUD + create + status + payment (8 endpoints)
2. **P0:** Auth (login, register, JWT) (3 endpoints)
3. **P1:** Customers CRUD + deposit (8 endpoints)
4. **P1:** Dashboard stats + kanban (3 endpoints)
5. **P2:** Reports (15 endpoints — read-only, safe to port first)
6. **P2:** Services + Groups (9 endpoints)
7. **P3:** Inventory, Expenses, Pickup, Attendance (~33 endpoints)
8. **P3:** Billing (4 endpoints)
9. **P4:** Super-Admin (~50 endpoints — least urgent, panel-only)
