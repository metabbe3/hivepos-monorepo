# API client usage (`lib/api/client.ts`)

`apiFetch` is the only HTTP entrypoint. Envelope-aware, cookie-auth, typed.

## Read

```ts
import { apiFetch } from "@/lib/api/client";
import type { components } from "@/lib/api/types";

type Order = components["schemas"]["Order"]; // whatever the contract names it
const { data, meta } = await apiFetch<Order[]>("/orders");
```

## Mutate

```ts
await apiFetch("/orders", { method: "POST", body: { customerId, items } });
await apiFetch(`/orders/${id}`, { method: "PATCH", body: { status } });
```

`body` is JSON-serialized automatically; `Content-Type: application/json` set when body present.

## Errors

`apiFetch` throws `ApiClientError` on any non-success envelope or HTTP error:

```ts
try {
  await apiFetch("/auth/login", { method: "POST", body: { email, password } });
} catch (e) {
  if (e instanceof ApiClientError) toast.error(e.message); // e.code, e.httpStatus, e.details
}
```

## Auth

Cookie-based JWT. The backend sets an httpOnly cookie on `/auth/login`; `apiFetch` sends
`credentials: "include"`, so the cookie rides along automatically. **Same-origin (Caddy) = no
CORS, cookies just work.** If you ever point `NEXT_PUBLIC_API_BASE_URL` cross-origin, the backend
must allow credentials + the exact origin (not wildcard).

## Base URL

`NEXT_PUBLIC_API_BASE_URL` (default `/api`). Swap backends without code changes:

| Value | Backend |
|---|---|
| `/api` (default) | whatever Caddy routes /api to — Go in prod |
| `http://localhost:8080/api` | Go directly (local dev, no Caddy) |
| `http://localhost:3007/api` | legacy pos-saas (transition fallback) |
