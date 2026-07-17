# hivePOS API

Comprehensive API reference for hivePOS. The full machine-readable spec is in
[`openapi.yaml`](./openapi.yaml); the Flutter client guide is in
[`FLUTTER_INTEGRATION.md`](./FLUTTER_INTEGRATION.md).

## TL;DR for mobile (Flutter)

- **The API is mobile-ready today.** Authenticate with `POST /api/auth/login` →
  get a `token` → send it as `Authorization: Bearer <token>` on every request.
- **No subdomain, no `?tenant=` on authenticated calls** — `tenantId`/`branchId`
  come from the token. Only *public* endpoints (`/api/public/*`, `/api/track/*`)
  need `?tenant=<slug>` or the `x-tenant-slug` header.
- **Envelope**: `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details? } }`.
- **Types**: money = JSON `number` (Decimal→Number), dates = ISO-8601 strings,
  ids = UUID strings. Deletes return `200 { data: { deleted: true } }` (no `204`).

## Coverage

**118 routes** across 19 domains. The OpenAPI spec lists every route with its
HTTP method(s), auth level, path/query parameters, request body, and response
envelope. The shared schemas (envelope, error, pagination) and the core domain
models (Order, Customer, Service, Branch, PickupRequest, Ticket, User, …) are
fully typed; some long-tail endpoints abbreviate rarely-used nested fields —
cross-check those against a live response if you depend on them.

### Auth levels

| Level | Meaning | Example |
|---|---|---|
| `public` | No auth | `/api/auth/login`, `/api/track/{orderNumber}`, `/api/health` |
| `session` | Tenant user (Bearer JWT) | `/api/orders`, `/api/customers` |
| `super-admin` | Platform staff (Bearer JWT, scope `super-admin` at login) | `/api/super-admin/*` |
| `webhook` | Signature/secret-verified | `/api/billing/webhook`, `/api/photo-cleanup` |

### Works on mobile vs. browser-only

| Endpoint | Mobile? | Why |
|---|---|---|
| `/api/printers/scan`, `/api/printers/test`, `/api/print` | ❌ | LAN TCP printer discovery/printing (the browser/device is on the customer's LAN; a phone isn't a reliable LAN printer host) |
| `/api/pwa/nonce`, `/api/super-admin/pwa/force-update` | ❌ | PWA service-worker mechanics — irrelevant to a native app |
| `/api/user/profile/oauth-link/start` | ❌ | Browser cookie + redirect Google OAuth flow |
| **everything else** | ✅ | Works via Bearer token |

> Mobile printing: use the platform's own printing (Android PrintManager /
> iOS UIPrintInteractionController) from a rendered receipt, not these LAN
> endpoints.

## Render & validate the OpenAPI spec

```bash
# Validate (0 errors expected)
npx @redocly/cli@latest lint docs/api/openapi.yaml

# Browse it interactively
npx @redocly/cli@latest preview-docs docs/api/openapi.yaml      # Redoc UI
# or
npx swagger-ui-watcher docs/api/openapi.yaml                     # Swagger UI

# Import into Postman: Import → File → docs/api/openapi.yaml
```

## Generate Dart client code (optional)

```bash
# Requires Java; produces a typed Dart API client + models from the spec
npx @openapitools/openapi-generator-cli generate \
  -i docs/api/openapi.yaml \
  -g dart-dio \
  -o ./hivepos_api_client
```

(You can equally just hand-roll a `dio` client from `FLUTTER_INTEGRATION.md` —
the contract is small and uniform.)

## Also see

- [`FLUTTER_INTEGRATION.md`](./FLUTTER_INTEGRATION.md) — full client guide with
  copy-paste Dart (auth, interceptors, envelope parsing, uploads, errors).
- [`../sop/api-routes.md`](../sop/api-routes.md) — server-side route patterns
  (guards, envelope helpers, error throwing) for anyone adding new endpoints.
