# Architecture

Deep dive on how hivePOS is wired. Read once, refer back.

## Stack

| Tech | Version | Purpose |
|---|---|---|
| Next.js | 16.1.6 | App Router, server components, API routes. Standalone output. |
| React | 19.2.3 | UI runtime |
| TypeScript | 5.7.0 | Strict mode, `noImplicitAny: false`, `@/*` path alias |
| Prisma | 7.5.0 | ORM with `@prisma/adapter-pg` driver (PostgreSQL 17) |
| NextAuth | 5.0.0-beta.31 | Auth.js v5 — credentials + Google OAuth, JWT strategy |
| Tailwind CSS | 4.1.0 | `@tailwindcss/postcss` plugin |
| Vitest | 4.1.9 | Unit tests, 80% coverage threshold |
| Playwright | 1.60.0 | E2E tests, baseURL `http://localhost:3007` |
| Midtrans | midtrans-client ^1.4.3 | Payment gateway (Snap.js popup) |
| Zod | ^4.3.6 | Body / form validation |
| Sonner | ^2.0.7 | Toast notifications |
| Recharts | ^3.8.1 | Charts on dashboard/reports |
| jsPDF + xlsx | - | Export utilities |
| tesseract.js | ^7.0.0 | OCR for receipt scanning |
| nodemailer | ^7.0.13 | Transactional email (ticket notifications) |
| pino | ^10.3.1 | Structured logging |

Dev server: **port 3007** (`npm run dev`).

## Directory map

| Dir | Purpose |
|---|---|
| `app/` | App Router pages, layouts, route handlers, server components |
| `components/` | React components (layout, ui primitives, dashboard, customer, roles, reports, etc.) |
| `lib/` | Framework-level utilities (auth, prisma, permissions, feature-flags, audit, i18n) |
| `modules/` | Domain modules with shared kernel (orders, customers, billing, etc.) |
| `hooks/` | Client React hooks (use-translation, use-permissions, use-feature-flag, use-role) |
| `prisma/` | `schema.prisma` + seed scripts (`seed.ts`, `seed-flags.ts`) |
| `types/` | `next-auth.d.ts` (session/JWT type augmentation) |
| `e2e/` | Playwright tests |
| `scripts/` | DB backfill / one-off scripts (`seed-billing.ts`, `seed-rbac.ts`) |
| `public/` | Static assets |
| `data/` | PostgreSQL data volume (docker-compose) |

### `lib/` subdirectories

**Core infra**
- `auth.ts` — NextAuth v5 config (providers, jwt/session callbacks, impersonation)
- `get-session.ts` — Unified session resolver (cookie OR bearer token, with `sessionVersion` check)
- `prisma.ts` — Prisma client singleton with `@prisma/adapter-pg`
- `rate-limit.ts` — IP-based login rate limit (10/min)

**Permissions**
- `permissions/definitions.ts` — RESOURCES, ACTIONS, RESOURCE_ACTIONS, `hasPermission`
- `permissions/check.ts` — `requireWithBranchOrThrow`, `requirePermissionOrThrow`
- `permissions/defaults.ts` — Default role → permission map
- `permissions/seed.ts` — `seedDefaultRoles(tx, tenantId)`, `backfillUserRoles(...)`
- `permissions/rbac.ts` — Client-side permission helpers

**Feature flags**
- `feature-flags.ts` — `resolveAllFlags(tenantId)`, `resolveFlag(key, tenantId)`, `FLAG_KEYS`
- `require-feature-flag.ts` — `requireFeatureFlag(key, session)`, `hasFeatureFlag(...)`

**Super-admin**
- `super-admin/permissions.ts` — `requireSuperAdminPanelSession`, `assertSuperAdminOrThrow`
- `super-admin/labels.ts` — UI constants

**Audit / logging**
- `audit.ts` — `auditLog(tx, input)` writer
- `audit-query.ts` — Audit log query builders (for super-admin viewer)
- `error-log-writer.ts` — ErrorLog persistence (called from `instrumentation.ts`)
- `register-error-log-writer.ts` — Server boot registration

**Tenant / cache**
- `tenant-cache.ts` — Per-slug TTL cache (60s) for website lookups
- `tenant.ts`, `tenant-code.ts`, `branch-context.ts`, `module-filter.ts`

**Business logic**
- `billing.ts`, `billing-analytics.ts`, `midtrans.ts`
- `tenant-performance.ts`, `pickup-insights` (in `app/super-admin/pickup-insights/`)
- `tickets.ts`, `tickets-admin.ts`, `tickets-tenant.ts`, `tickets-constants.ts`
- `user-admin.ts`, `whatsapp.ts`, `email.ts`, `email-templates/ticket-events.ts`
- `order-transform.ts`, `service-transformer.ts`, `fast-cash.ts`, `export-utils.ts`, `csv.ts`
- `validations.ts`, `forms/` (schemas + types)

**Printing / hardware**
- `escpos.ts` — Thermal printer ESC/POS byte builder
- `printer-scanner.ts` — Network printer discovery
- `client-printer.ts` — Client-side print interface
- `web-printer.d.ts` — WebBluetooth/WebUSB type defs

**i18n / utils**
- `i18n.ts` — English + Indonesian translations (~400 keys, flat dot-notation)
- `utils.ts` — `cn()` class-variance merge
- `format.ts`, `dates.ts`, `constants.ts`, `fonts.ts`, `landing-data.ts`

### `modules/` (domain modules + shared kernel)

Each domain module owns types/business rules for its slice:
- `orders/`, `customers/`, `services/`, `inventory/`, `expenses/`
- `pickup-requests/`, `billing/`, `roles/`, `users/`, `branches/`

**Shared kernel** (`modules/shared/`):
- `errors/` — `AppError` hierarchy + `error-code.ts` (HTTP status mapping) + `prisma-errors.ts` (Prisma → AppError)
- `http/` — `withErrorHandler`, `apiSuccess`, `apiCreated`, `apiError`, `apiFetch`, `ApiClientError`, `SuccessEnvelope`, `ErrorEnvelope`
- `logging/` — Pino logger
- `domain/` — `BusinessModule` enum, value objects
- `application/` — `RequestContext`, `password.ts` (bcrypt), `session-version.ts`
- `serialization/` — Decimal serialization helpers

Import pattern: `import { withErrorHandler, apiSuccess, NotFoundError, logger } from "@/modules/shared";`

## Auth & session architecture

### NextAuth v5 config (`lib/auth.ts`)

**Providers:**
- **Credentials** — email + password (bcrypt), rate-limited 10/min per IP
- **Google OAuth** — account linking by email, only if `lastLoginAt` exists (anti-takeover)

**JWT callback** enriches the token with everything the app needs:
- `tenantId`, `branchId`, `branchName`, `tenantName`, `tenantSlug`
- `activeModules[]`, `activeModule` (current selection)
- `sessionVersion` (for single-session enforcement + revocation)
- `permissions[]` (RBAC strings from the user's Role)
- `roleId`, `roleName`
- `featureFlags{}` (resolved once at login via `resolveAllFlags(tenantId)`)

**Three flag-resolution paths in jwt callback** (touch all three when changing):
1. Credentials login (`lib/auth.ts:324`)
2. Google OAuth login (`lib/auth.ts:351`)
3. Session refresh on `sessionVersion` bump (`lib/auth.ts:393`)
4. Impersonation target swap (`lib/auth.ts:469`) — separate path for super-admin-as-tenant

**Special flows:**
- **Super-admin scope** — `?scope=super-admin` on login routes to `SuperAdmin` table (separate from `User`)
- **Pending tenant** — registration creates inactive Tenant; login returns `redirect("/login?error=pending-approval")`
- **Impersonation** — super-admin can swap claims to any tenant user. Snapshot saved to `token.preImpersonation`. Stop restores from snapshot.

### Session callback

Exposes all JWT claims to the client via `session.user.*`. Adds `impersonating: boolean` + `impersonatedEmail` when active.

### Bearer-token API sessions (`lib/get-session.ts`)

API routes use `getApiSession()` which supports:
- Cookie-based sessions (NextAuth JWT)
- Bearer tokens via `Authorization: Bearer <jwt>` header (mobile/external clients)

Enforces `sessionVersion` against DB on every call. If token version ≠ DB version → reject (revoked by new login or `/api/auth/revoke-sessions`).

### Impersonation flow

```
SuperAdmin → POST /api/super-admin/impersonate { impersonateUserId }
  ↓
JWT callback: snapshots current token to preImpersonation,
              swaps claims to target user,
              resolves target tenant's featureFlags
  ↓
Banner shows "Impersonating {email}" in client UI
  ↓
POST /api/super-admin/impersonate/stop { stopImpersonation: true }
  ↓
JWT callback: restores from preImpersonation snapshot
```

## Prisma schema overview

### Platform-level (super-admin)
- `SuperAdmin` — Platform admins (`SUPER_ADMIN` or `SUPPORT` role) + `sessionVersion`
- `AuditLog` — Immutable trail (`actorId`, `action`, `targetType`, `targetId`, `tenantId?`, `diff?`, `reason?`, `ipAddress?`, `userAgent?`)
- `ErrorLog` — 5xx errors with `resolved` boolean for triage
- `SupportTicket`, `TicketComment` — Support tickets + threaded replies
- `Plan` — Subscription tiers (Free/Growth/Pro, stored as `tier` enum)
- `FeatureFlag`, `TenantFeatureFlag` — Flag catalog + per-tenant overrides
- `PromoCode`, `PromoRedemption` — Billing promos
- `SaaSPayment` — Per-outlet coverage payments

### Tenant-level
- `Tenant` — Multi-tenant business (`slug`, `customDomain?`, `activeModules[]`, `websiteEnabled`)
- `Subscription` — Tenant → Plan link, status enum
- `Branch` — Outlet (`slug` for pickup URL, printer config, `coverageEnd`)
- `User` — Staff (`roleId`, `sessionVersion`, `lastLoginAt`, `isActive`)
- `Role` — RBAC (`permissions[]`, `isSystem`, `color`)

### Core business
- `Customer` + `DepositTransaction` — Wallet system
- `Service`, `ServiceGroup` — Catalog (`pricingType: PER_KG | PER_ITEM | FLAT`)
- `Order`, `OrderItem`, `Payment` — Order lifecycle (CASH/TRANSFER/QRIS/DEPOSIT)
- `PickupRequest` — PENDING → ACCEPTED → SCHEDULED → CONVERTED
- `StockItem`, `StockMovement` — Inventory
- `Expense`, `ExpenseCategory` — Operational expenses

### Key enums
- `UserRole`: OWNER, MANAGER, EMPLOYEE
- `SuperAdminRole`: SUPER_ADMIN, SUPPORT
- `BusinessModule`: LAUNDRY, FNB, SALON, CLEANING
- `SubscriptionStatus`: TRIAL, ACTIVE, PAST_DUE, CANCELED, EXPIRED
- `PricingType`: PER_KG, PER_ITEM, FLAT
- `OrderStatus`: RECEIVED, IN_PROGRESS, READY, DELIVERED, CANCELED
- `PaymentMethod`: CASH, TRANSFER, QRIS, DEPOSIT
- `PaymentStatus`: PENDING, PARTIAL, PAID, REFUNDED
- `PickupRequestStatus`: PENDING, ACCEPTED, SCHEDULED, CONVERTED, REJECTED, CANCELED

## Config files

| File | Purpose |
|---|---|
| `next.config.ts` | Standalone output, HSTS + CSP headers, `serverExternalPackages: ["pg"]` |
| `tsconfig.json` | `@/*` path alias, strict mode, incremental compilation, target ES2022 |
| `middleware.ts` | Edge-runtime middleware: subdomain routing (`slug.hivepos.id`), bearer→cookie rewrite for API auth, redirect rules |
| `instrumentation.ts` | Server boot hook — registers ErrorLog writer so 5xx errors auto-persist |
| `postcss.config.mjs` | `@tailwindcss/postcss` plugin |
| `prisma.config.ts` | Prisma CLI config (`schema: "prisma/schema.prisma"`, `datasource.url: env("DATABASE_URL")`) |
| `docker-compose.yml` | PostgreSQL 17 service with healthcheck + data volume |
| `Dockerfile` | Multi-stage build (deps → builder → runner), Prisma generate, standalone output |
| `vitest.config.ts` | Environment `node`, setup `lib/test/setup.tsx`, includes `**/*.test.{ts,tsx}`, 80% coverage threshold |
| `playwright.config.ts` | testDir `./e2e`, baseURL `localhost:3007`, retries 1, auto-starts dev server |
| `.env.example` | Required env vars (DATABASE_URL, AUTH_SECRET, GOOGLE OAuth keys, MIDTRANS keys, SMTP) |
