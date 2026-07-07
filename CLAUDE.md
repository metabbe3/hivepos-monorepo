# CLAUDE.md

hivePOS API — Go backend for the hivePOS laundry SaaS.
Domain-based monolith. Same PostgreSQL as the Next.js frontend (shared during transition).
Go 1.26, chi router, pgx/v5, golang-jwt/v5, bcrypt.

## Quick start

```bash
cd Documents/hivepos-api
cp .env.example .env
go mod tidy
go run cmd/server/main.go          # http://localhost:8080
curl http://localhost:8080/api/health
```

Test / verify before shipping:
```bash
go vet ./...
go test ./...
go build cmd/server/main.go       # 0 errors
docker build -f deployments/Dockerfile -t hivepos-api .   # image builds
```

> **Navigation: RAG-first** — before grepping/Read to *locate* code, query the
> structural index: `go run scripts/codebase-rag.go query "<term>"`. See
> `docs/codebase-rag.md` (when written).

## Stack at a glance

| Tech | Version | Purpose |
|---|---|---|
| Go | 1.26 | HTTP server, business logic, type safety |
| chi | v5 | HTTP routing, middleware chains |
| pgx | v5 | PostgreSQL driver (stdlib `database/sql` compatible) |
| golang-jwt | v5 | JWT generation/validation (mirrors NextAuth shape) |
| bcrypt | x/crypto | Password hashing (12 rounds, same as TS) |
| Docker | multi-stage | alpine builder → alpine runtime |

## Architecture

**Domain-based monolith.** Each business domain is a self-contained module with
hexagonal architecture:

```
internal/modules/{domain}/
├── domain/           # Entities, enums, value objects (no deps)
├── application/      # Use cases, DTOs, repository ports (interfaces)
├── infrastructure/   # PostgreSQL repository implementations
└── routes.go         # HTTP handler registration (chi sub-router)
```

**Transport layer:** HTTP (chi) is the primary. gRPC is a thin adapter on the SAME
service layer — added per-endpoint when needed (inter-service calls, mobile), not
upfront.

## Non-negotiables

These rules exist because breaking them breaks the TS↔Go contract during transition.

1. **Same database schema.** Go reads/writes the SAME PostgreSQL tables as the TS app.
   Never alter the schema from Go (use Prisma migrations from pos-saas).
2. **Same JWT claims shape.** The Go `Claims` struct must match the NextAuth JWT.
   Tokens issued by TS must validate in Go and vice versa.
3. **Same API response envelope.** `{ success: bool, data?: any, meta?: any, error?: { message } }`.
   Use `shared/http.Success`, `shared/http.Created`, `shared/http.Error`.
4. **Same RBAC resources + actions.** All 14 resources + 6 actions defined in `internal/rbac/rbac.go`.
   Permission strings: `"resource:action"` (e.g. `"orders:read"`).
5. **Every tenant-scoped query filters by `tenantId`.** Extract from JWT claims via
   `middleware.RequireTenant`. Never trust client-supplied `tenantId`.
6. **Every write returns audit-worthy data.** Use transactions for multi-table writes.
   Same pattern as TS (`db.BeginTx` → commit/rollback).
7. **Mark deliberate shortcuts** with `// ponytail: <ceiling> — <upgrade path>`.
8. **Caveman mode + Ponytail mode inherited** from the pos-saas project. Terse output,
   lazy solutions, shortest diff wins.

## Conventions

- **Error handling:** Return `*AppError` from services; the HTTP handler calls
  `shared/http.Error(w, err.Status, err.Message)`. Never build error responses manually.
- **Context propagation:** `context.Context` flows from the HTTP handler through
  services to repositories. Cancelation + timeouts respected.
- **Repository interface:** Each module defines its repository port in
  `application/`. The PostgreSQL implementation is in `infrastructure/`. The transport
  layer depends on the interface, not the implementation.
- **DTOs:** Request/response shapes in `application/dto.go`. Domain entities in
  `domain/types.go`. Never leak domain entities directly to the HTTP layer.
- **Migration:** Before implementing a TS endpoint in Go, read the TS route handler +
  the service + the Prisma query. Mirror the logic + the response shape exactly.
  Document the port in `docs/endpoint-gap.md`.

## Doc map

| File | Read when… |
|---|---|
| `docs/endpoint-gap.md` | Porting an endpoint — check what's done vs not |
| `README.md` | Architecture overview + migration strategy |
| `deployments/docker-compose.yml` | Running the API standalone |
| `.env.example` | Environment variables |

## Common file map

| File | What |
|---|---|
| `cmd/server/main.go` | Entry point — config + DB + router + graceful shutdown |
| `internal/config/config.go` | Env-based configuration |
| `internal/database/postgres.go` | pgx connection pool |
| `internal/auth/context.go` | JWT manager + Claims struct + middleware |
| `internal/middleware/middleware.go` | CORS, auth, RBAC, tenant context |
| `internal/rbac/rbac.go` | Permission resources + actions + HasPermission |
| `internal/router/router.go` | Chi router + health check + ModuleRouter interface |
| `internal/shared/errors/errors.go` | AppError hierarchy |
| `internal/shared/http/response.go` | Response envelope (Success/Created/Error) |
| `internal/modules/orders/` | Order domain (reference implementation pattern) |

## Git conventions

- **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- **Branch naming**: `feat/<scope>`, `fix/<scope>`, `port/<domain>`.
- **Co-author trailer**: `Co-Authored-By: Claude <noreply@anthropic.com>`.
- **Never** commit `.env`, `*.exe`, `tmp/`.
