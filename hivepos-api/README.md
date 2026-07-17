# hivePOS API (Go)

Go backend for hivePOS — a progressive migration from the Next.js monolith. Same
PostgreSQL database, same API contract, domain-based monolith architecture.

## Architecture

```
hivepos-api/
├── cmd/server/           # Entry point (main.go)
├── internal/
│   ├── config/           # Environment configuration
│   ├── database/         # PostgreSQL connection pool (pgx)
│   ├── auth/             # JWT management (mirrors NextAuth JWT shape)
│   ├── middleware/        # CORS, auth, RBAC, tenant context
│   ├── rbac/             # Permission definitions (mirrors TS RESOURCES)
│   ├── router/           # Chi router + health check
│   ├── shared/
│   │   ├── errors/       # AppError hierarchy (ValidationError, NotFoundError, etc.)
│   │   ├── http/         # Response envelope (apiSuccess, apiCreated, apiError)
│   │   └── serialization/ # Date/Decimal helpers (TODO)
│   └── modules/          # Domain modules (hexagonal architecture)
│       ├── orders/       # Order domain
│       │   ├── domain/       # Entities + enums
│       │   ├── application/  # Services + DTOs + Repository port
│       │   └── infrastructure/ # PostgreSQL repository implementation (TODO)
│       ├── customers/    # Customer domain (TODO)
│       ├── services/     # Service catalog domain (TODO)
│       ├── inventory/    # Stock management domain (TODO)
│       ├── expenses/     # Expense tracking domain (TODO)
│       ├── branches/     # Outlet management domain (TODO)
│       ├── users/        # User/staff management domain (TODO)
│       ├── attendance/   # Staff attendance domain (TODO)
│       ├── billing/      # SaaS billing domain (TODO)
│       ├── pickup/       # Pickup request domain (TODO)
│       ├── reports/      # Reporting domain (TODO)
│       ├── dashboard/    # Dashboard stats domain (TODO)
│       ├── superadmin/   # Super-admin platform domain (TODO)
│       └── auth/         # Auth domain (login, register, OAuth) (TODO)
├── deployments/
│   ├── Dockerfile        # Multi-stage Go build
│   └── docker-compose.yml # API + DB
├── migrations/           # SQL migrations (TODO — use the same Prisma schema)
├── docs/                 # Architecture docs (TODO)
├── go.mod
├── go.sum
└── .env.example
```

## Design Principles

1. **Same DB, different transport.** Go connects to the same PostgreSQL as the Next.js
   app. Read the same tables, write the same rows. During transition, both apps serve
   the same users — Next.js for the frontend + Go for heavy/scale-critical endpoints.

2. **Domain-based monolith.** Each module (`orders`, `customers`, `services`, etc.) is
   a self-contained domain with its own entities, services, and repositories. No
   microservices yet — but the boundaries are clean for future extraction.

3. **Hexagonal architecture per module.** `domain/` (entities) → `application/`
   (use cases + ports) → `infrastructure/` (PostgreSQL adapters). The transport layer
   (HTTP/gRPC) calls application services, never touching the database directly.

4. **gRPC as a thin top layer.** HTTP handlers (chi router) serve the frontend.
   gRPC handlers (when added) wrap the SAME service layer — just a different transport.
   Minimal proto definitions; services stay shared.

5. **Mirrors the TypeScript contract.** Same API response envelope (`{ success, data, meta }`),
   same JWT claims shape, same RBAC resources/actions, same error codes. The frontend
   can call either backend without changes.

## Quick Start

```bash
cd Documents/hivepos-api
cp .env.example .env
go mod tidy
go run cmd/server/main.go
# → ✓ Connected to PostgreSQL
# → ✓ hivePOS API listening on :8080
```

Health check: `curl http://localhost:8080/api/health`

## Migration Strategy

| Phase | What | How |
|---|---|---|
| 1 (current) | Scaffold + health check | Go server running, same DB |
| 2 | Read endpoints | Port GET routes (reports, dashboard, list) — read-only, safe |
| 3 | Auth + write endpoints | Login, register, order create — the critical path |
| 4 | Feature-complete | All 138 endpoints ported |
| 5 | Frontend switch | Next.js proxy → Go API (or frontend calls Go directly) |
| 6 | Decommission | Remove API routes from Next.js (frontend-only) |

## gRPC Strategy

gRPC is a **thin adapter** on top of the existing service layer:

```
HTTP Handler (chi)  →  Service  →  Repository  →  PostgreSQL
gRPC Handler (proto) →  Service  →  Repository  →  PostgreSQL
                         ↑ same
```

- Only add gRPC when a specific endpoint needs it (inter-service calls, mobile app, real-time streaming).
- Protos are minimal — one proto per domain, mirroring the service interface.
- The HTTP API is always the primary interface for the frontend.
