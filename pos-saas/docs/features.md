# Feature Inventory

What hivePOS actually does. Use this as the "where do I find X?" reference.

## Tenant dashboard routes (`app/(dashboard)/`)

### Cross-module (shared)
| Route | Purpose | Module | Permission | Flag |
|---|---|---|---|---|
| `/dashboard` | Stats cards, revenue trend, order pipeline, heatmaps | shared | `dashboard:read` | `dashboard` |
| `/customers` | Customer list with search/filter | shared | `customers:read` | `customers` |
| `/customers/[id]` | Customer detail, order history, deposit wallet | shared | `customers:read` | `customers` |
| `/reporting` | Reports hub (revenue, expenses, profit, P&L, etc.) | shared | `reports:read` | `reports` |
| `/tickets` | Support ticket list (Bantuan) | shared | (public for tenants) | `tickets` |
| `/tickets/new` | Submit a ticket | shared | (public) | `tickets` |
| `/tickets/[id]` | Ticket detail, replies, CSAT | shared | (public) | `tickets` |

### Laundry module
| Route | Purpose | Permission | Flag |
|---|---|---|---|
| `/laundry/orders` | Orders list + filters + bulk actions | `orders:read` | `orders` |
| `/laundry/orders/new` | POS order creation (garment breakdown, express, discount) | `orders:create` | `orders` |
| `/laundry/orders/[id]` | Order detail + status transitions + payments | `orders:read` | `orders` |
| `/laundry/orders/[id]/receipt` | Thermal printer receipt view | `orders:read` | `orders` |
| `/laundry/pickup-requests` | Pickup workflow (accept/schedule/convert) | `pickupRequests:read` | `pickupRequests` |
| `/laundry/services` | Service catalog + groups + pricing types | `services:read` | `services` |
| `/laundry/inventory` | Stock items + movements + low-stock alerts | `inventory:read` | `inventory` |
| `/laundry/expenses` | Expenses + categories | `expenses:read` | `expenses` |

### F&B module
| Route | Purpose | Permission | Flag |
|---|---|---|---|
| `/laundry/orders` (shared) | Order management | `orders:read` | `orders` |
| `/laundry/services` (as Menu) | Menu items | `services:read` | `services` |

### Salon module
| Route | Purpose | Permission | Flag |
|---|---|---|---|
| `/laundry/orders` (shared) | Service orders | `orders:read` | `orders` |
| `/laundry/services` | Service catalog | `services:read` | `services` |

### Admin
| Route | Purpose | Permission | Flag |
|---|---|---|---|
| `/branches` | Outlet list | `branches:read` | `branches` |
| `/branches/[id]` | Branch detail, printer config, coverage | `branches:read` | `branches` |
| `/users` | Staff management | `users:read` | `users` |
| `/roles` | Role + permission matrix editor | `roles:read` | `roles` |
| `/billing` | Plan, subscription, payment history | `billing:read` | `billing` |
| `/website` | Website builder (Pro plan) | `billing:read` | `website` |
| `/profile` | Own profile + password + OAuth link | (self) | (none) |

## Super-admin panel (`app/super-admin/`)

Auth gate: `requireSuperAdminPanelSession()` (server component).

### Monitor group
| Route | Purpose |
|---|---|
| `/super-admin` | Overview: MRR, active tenants, trial conversions, pending approvals, open tickets, errors |
| `/super-admin/performance` | System performance metrics |
| `/super-admin/health` | Health check status |
| `/super-admin/pickup-insights` | Pickup request analytics |

### Customers group
| Route | Purpose |
|---|---|
| `/super-admin/tenants` | All tenants list + filters |
| `/super-admin/tenants/[id]` | Tenant detail + approve/suspend/billing |
| `/super-admin/plans` | Plan management (Growth/Pro) |
| `/super-admin/promo-codes` | Promo code CRUD |
| `/super-admin/referrals` | Referral ledger + void (spec: `docs/specs/referral-program.md`) |
| `/super-admin/billing` | Platform billing overview, failed payments |
| `/super-admin/users` | All platform users |

### Operations group
| Route | Purpose | SUPER_ADMIN only? |
|---|---|---|
| `/super-admin/tickets` | All support tickets | no |
| `/super-admin/tickets/[id]` | Ticket detail + priority + replies | no |
| `/super-admin/error-logs` | 5xx error log viewer | no |
| `/super-admin/audit-log` | Audit trail viewer | no |
| `/super-admin/admins` | Super-admin user management | **yes** |
| `/super-admin/feature-flags` | Feature flag list + global toggle | **yes** |
| `/super-admin/feature-flags/[id]` | Per-flag tenant overrides (whitelist/blacklist) | **yes** |
| `/super-admin/settings` | Platform settings | no |

### Account
- `/super-admin/login` — Dedicated super-admin login
- `/super-admin/me/password` — Change own password
- `/super-admin/me/sessions` — Active session management

## Public / unauthenticated routes

| Route | Purpose |
|---|---|
| `/login` | Email/password or Google OAuth. Handles pending-approval + OAuth-link-required states |
| `/register` | New tenant registration (Beta Partner flow) |
| `/pickup/[branchSlug]` | Public pickup request form for customers |
| `/track/[orderNumber]` | Public order tracking (real-time status timeline + QRIS display) |
| `/tenant-site` | Generated tenant website (Pro plan, served at `slug.hivepos.id`) |
| `/support` | Public support landing |

## API route groups (`app/api/`)

| Group | Purpose |
|---|---|
| `auth/[...nextauth]` | NextAuth handlers (login, logout, session) |
| `auth/session-version` | Session version check |
| `register` | New tenant registration |
| `orders`, `orders/[id]`, `orders/[id]/status`, `orders/[id]/payments` | Order CRUD + lifecycle |
| `customers`, `customers/[id]`, `customers/[id]/deposit`, `customers/[id]/stats` | Customer CRUD + wallet + analytics |
| `services`, `services/[id]`, `service-groups` | Service catalog |
| `stock-items`, `stock-items/[id]/movements` | Inventory |
| `expenses`, `expense-categories` | Expense tracking |
| `reports/{revenue,expenses,profit,orders,customers,inventory,outstanding,financial-statement,monthly-pnl,commission,payment-collection}` | Reports by type |
| `reports/export`, `reports/monthly-pnl/export` | CSV/PDF export |
| `pickup-requests`, `pickup-requests/[id]/{accept,schedule,reject,assign,convert}` | Pickup workflow |
| `pickup-requests/count-pending` | Sidebar badge counter |
| `billing/{status,checkout,webhook}`, `billing/promo/validate` | Subscription + Midtrans + promos |
| `tickets`, `tickets/[id]` | Support tickets |
| `branches`, `branches/[id]` | Branch CRUD |
| `users`, `users/[id]`, `roles`, `roles/[id]` | Staff + role management |
| `dashboard/{stats,heatmap,kanban}` | Dashboard widgets |
| `print`, `printers/{scan,test}` | Receipt printing + network printer discovery |
| `user/profile`, `user/profile/oauth-link` | Self-service profile |
| `tenant/website` | Website builder settings |
| `public/{branches,services,pickup-requests,tickets,orders/track}` | Public unauthenticated APIs |
| `track/[orderNumber]` | Order tracking lookup |
| `health` | Health check |
| `super-admin/*` | ~20 super-admin endpoints (see below) |

### Super-admin API (`app/api/super-admin/`)
- `stats`, `performance/*`, `health`
- `tenants`, `tenants/[id]`, `tenants/[id]/{approve,suspend,billing,subscription}`
- `users`, `users/[id]/{suspend,reset-password}`, `users/export`
- `admins`, `admins/[id]`
- `billing/{overview,payments}`, `billing/payments/[id]/refund`, `billing/payments/export`
- `plans`, `plans/[id]`
- `promo-codes`, `promo-codes/[id]`
- `tickets`, `tickets/[id]`, `tickets/[id]/priority`
- `error-logs/[id]/resolve`
- `feature-flags`, `feature-flags/[id]`, `feature-flags/[id]/tenants`, `feature-flags/[id]/tenants/[tenantId]`
- `impersonate`, `impersonate/stop`
- `me/{password,sessions}`
- `audit-log/export`

## Components inventory

### `components/layout/`
- `app-sidebar.tsx` — Tenant sidebar (4 buckets, flag + permission gated)
- `super-admin-sidebar.tsx` — Super-admin sidebar (3 groups: Monitor / Customers / Operations)
- `header.tsx`, `super-admin-header.tsx` — Top bars

### `components/ui/` (shadcn-style primitives)
badge, button, card, checkbox, dialog, dropdown-menu, label, scroll-area, select, separator, sheet, sidebar, skeleton, switch, table, tabs, textarea, tooltip, sonner (toast).

### `components/shared/`
- `page-header.tsx`, `form-field.tsx`, `card-list.tsx`, `data-table-card.tsx`, `crud-dialog.tsx`
- `stat-card.tsx`, `report-table.tsx`, `loading.tsx`, `skeletons.tsx`, `empty-state.tsx`
- `session-guard.tsx`, `branch-selector.tsx`, `module-selector.tsx`
- `theme-toggle.tsx`, `language-toggle.tsx`, `date-range-picker.tsx`, `trend-chart.tsx`

### `components/dashboard/`
- `stats-cards.tsx`, `revenue-trend-card.tsx`, `order-pipeline-card.tsx`
- `customer-insights-card.tsx`, `service-breakdown-card.tsx`, `payment-methods-card.tsx`
- `cash-flow-card.tsx`, `turnaround-card.tsx`, `service-composition-card.tsx`
- `top-customers-card.tsx`, `alert-summary-card.tsx`, `heatmap-card.tsx`
- `pickup-badge.tsx`, `pickup-request-detail-dialog.tsx`

### `components/customer-*`, `components/roles-*`, `components/reports-*`
Module-specific UI clusters. Customer detail uses tabs (orders / deposits / info). Roles page uses permission matrix editor. Reports share a common `report-table.tsx` shell.

### Other component groups
- `components/profile/` — Profile hero, password change (with strength meter), OAuth link card
- `components/tickets/` — Status badges, priority badges
- `components/pos/` — Garment breakdown editor, speed modal
- `components/public/` — Hero, stats banner, services grid, testimonials, FAQ, price estimator, WhatsApp FAB
- `components/landing/` — LandingNav, PaymentMarquee, ScrollReveal

## Business modules

### Laundry (full operations)
- **Orders** — POS creation with garment breakdown, express surcharge, discount, multi-payment (cash + transfer + QRIS + deposit). Status timeline: RECEIVED → IN_PROGRESS → READY → DELIVERED. Receipt printing via ESC/POS.
- **Pickup requests** — Customer-initiated. Workflow: PENDING → ACCEPTED → SCHEDULED → CONVERTED (becomes an order). Optional courier assignment.
- **Services** — Catalog with three pricing types: `PER_KG`, `PER_ITEM`, `FLAT`. Groupable into service groups.
- **Inventory** — Stock items with low-stock alerts. Movements: IN / OUT / ADJUSTMENT.
- **Expenses** — Operational expenses with categories. Used in P&L reports.

### F&B (foundation)
- **Orders** — Shared with laundry order infrastructure.
- **Menu** — Implemented via `Service` model with `pricingType: PER_ITEM` or `FLAT`.

### Salon (foundation)
- **Orders** — Shared infrastructure.
- **Services** — Catalog (haircut, coloring, etc.).

### Cross-module features
- **Customers** — Profiles, contact info, status (ACTIVE/INACTIVE/BLACKLISTED), order history, stats.
- **Deposits** — Wallet system. Top-up → use in order payment. Transaction history. `DepositTransaction` types: TOP_UP / DEDUCTION / REFUND.
- **Reports** — Revenue, expenses, profit, monthly P&L, financial statements, outstanding balances, customer analytics, inventory reports, commission, payment collection. Export to CSV/PDF.
- **Dashboard** — Real-time stats, revenue trends, order pipeline, heatmaps (busy hours, revenue, customers), customer insights.
- **Branches** — Multi-outlet. Each has slug (for pickup URL), printer config, coverage end date, operating hours, geolocation. "Semua Outlet" (ALL) mode aggregates.
- **Users** — Staff management. Roles assigned per user. Active/inactive toggle. Password reset.
- **Roles** — Custom RBAC roles. Owner gets wildcard `"*"`. Permission matrix editor.
- **Billing** — Plan tiers, subscription, per-outlet coverage, Midtrans Snap checkout, payment history.
- **Website** — Pro-plan website builder.
- **Tickets (Bantuan)** — Support tickets with priority, status workflow, threaded comments, CSAT ratings.

## Billing & subscriptions

### Plan tiers
| Plan | Price (per outlet/month) | Key features |
|---|---|---|
| **Free Trial** | Rp 0 | 3-month trial, limited users/orders |
| **Growth** | Rp 49K | Unlimited staff + orders |
| **Pro** | Rp 79K | Growth + Website builder |

### Subscription lifecycle
1. **Trial** — 3 months free on approval (`Tenant.createdAt + 90 days`)
2. **Plan selection** — Owner picks Growth/Pro at `/billing`
3. **Outlet coverage** — Pick which outlets to renew (1/3/6/12 months)
4. **Checkout** — Midtrans Snap popup (bank transfer, e-wallet, QRIS)
5. **Webhook** — `/api/billing/webhook` confirms → extends `Branch.coverageEnd`
6. **Locked outlets** — Past `coverageEnd` = orders blocked (`OutletLockedError`)

### Midtrans integration
- `lib/midtrans.ts` wraps `midtrans-client` Snap.
- Checkout creates transaction → returns Snap token → frontend opens popup.
- Webhook verifies signature → records `SaaSPayment` → extends coverage.
- Failed payments surface on `/super-admin/billing` for retry.

## Website builder (Pro plan)

**URL**: `slug.hivepos.id` (subdomain routing in `middleware.ts`) or via `/tenant-site`.

**Auto-generated content**:
- Hero with tagline + photo
- Trust signals (Google rating, years in business, processing time)
- Service catalog with pricing (pulled from `Service` table)
- FAQ (default or custom)
- Testimonials (with star ratings)
- Area served
- Operating hours + map location
- QRIS payment display
- WhatsApp floating button (order/inquiry intent)

**SEO**: JSON-LD structured data, meta tags, sitemap.xml.

**Content management**: Tenant edits at `/website` (Pro-plan gated + feature flag).

## Tickets / Bantuan

**Tenant side** (`/tickets`):
- Create ticket with category (bug, feature, billing, technical) + priority (low/medium/high/urgent)
- Threaded comments with email notifications (`lib/email-templates/ticket-events.ts`)
- CSAT rating on resolution

**Super-admin side** (`/super-admin/tickets`):
- View all tenant tickets
- Update priority + status
- Reply in thread
- Audit trail via `auditLog`

## i18n

- **Languages**: `en` + `id` (English + Indonesian). Translations in `lib/i18n.ts`.
- **Hook**: `useTranslation()` returns `{ t, lang, setLang }`. Use `t("dotted.key")`.
- **Coverage**: ~400 keys — UI labels, status names, error messages, nav items.
- **No interpolation.** Use manual `.replace("{name}", value)` for parameterized strings.
- **Locale-aware dates**: `new Date(...).toLocaleString(lang === "id" ? "id-ID" : "en-US")`.
- **Toggle**: `components/shared/language-toggle.tsx` — persists choice in `localStorage`.
