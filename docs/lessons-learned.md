# Lessons Learned — hivepos-api (Go backend)

Append-only ledger of bugs shipped + root causes + prevention rules. Read before claiming any task "done." Each entry: **Symptom → Root cause → Fix → Prevention rule**.

## 1. config ignored `.env` (PORT always 8080)

- **Symptom**: Server always started on :8080 regardless of `.env` `PORT=8099`; had to launch with `PORT=8099 ./server` inline.
- **Root cause**: `config.Load()` read `os.Getenv` only — no `.env` file loading. The `.env` file was never parsed.
- **Fix**: Added `github.com/joho/godotenv` → `_ = godotenv.Load()` at the start of `config.Load()`.
- **Prevention rule**: **config must load `.env`** — add godotenv to any new Go service that uses env-based config.

## 2. Midtrans checkout returned `{token}` but FE reads `{snapToken}` → nothing opens

- **Symptom**: Clicking "Pay" on billing did nothing (no Snap popup). No error toast.
- **Root cause**: `CheckoutResult` used `json:"token"` but the FE handler reads `data.snapToken` (legacy contract). Field name mismatch → `undefined` → `window.snap.pay` never called.
- **Fix**: Changed `CheckoutResult` JSON tags to `{status, snapToken, redirectUrl, message}`.
- **Prevention rule**: **FE↔BE field names must match exactly** — after implementing an endpoint, curl it + check the JSON keys against what the FE reads. Don't trust struct field names alone.

## 3. Pricing hardcoded `50000` instead of Plan.priceMonthly

- **Symptom**: Billing page showed Rp 50.000/outlet but the Growth plan price was Rp 49.000.
- **Root cause**: `billing/routes.go` status handler hardcoded `Pricing{OriginalUnitPrice: 50000, UnitPrice: 50000}` — ignored the Plan table entirely.
- **Fix**: Fetch Growth/Pro prices via `GetPlanByTier` → set `Pricing` + new `growthPrice`/`proPrice` fields from the real Plan rows.
- **Prevention rule**: **Never hardcode plan/config values** — read from the Plan table (or SystemSetting). If a value is configurable by an admin, it must come from the DB.

## 4. `planlimits` order-count query errored under pgx (`time.Now()` param)

- **Symptom**: `billing/status` usage counts returned 0/0/0 even though the tenant had 4 outlets + orders.
- **Root cause**: The orders count query passed `time.Now()` as a `$2` param for `date_trunc('month', $2)`. pgx's encoding of `time.Time` to the `date_trunc` function caused a silent error → `UsageCounts` returned err → billing handler swallowed it → zeros.
- **Fix**: Replaced the Go time param with DB-side `date_trunc('month', NOW())` (no param).
- **Prevention rule**: **Use DB `NOW()` in SQL date bounds** — don't pass Go `time.Time` as a param to Postgres date functions under pgx. If a query silently returns zero/error, log the error instead of swallowing it.

## 5. Webhook signature was stub (accepted any signature)

- **Symptom**: The Midtrans webhook accepted any `signature_key` (even forged) — security hole.
- **Root cause**: `HandleWebhook` only checked `input.SignatureKey == ""` (non-empty), not HMAC verification.
- **Fix**: Added `midtrans.VerifySignature` (SHA-512 `order_id+status_code+gross_amount+server_key`).
- **Prevention rule**: **Verify webhook signatures before acting** — always implement HMAC verification when integrating a payment provider webhook.

## 6. Google OAuth was a mock (returned `stub@google.com`)

- **Symptom**: Google login button did nothing useful — backend returned a mock JWT.
- **Root cause**: `POST /api/auth/google` returned a hardcoded `{"token":"mock-google-jwt"}` — no real OAuth flow.
- **Fix**: Implemented server-side redirect flow: `GET /google` → consent → `GET /google/callback` → code exchange + userinfo + user upsert + JWT mint → redirect to FE.
- **Prevention rule**: **The Bearer-in-localStorage model requires server-side OAuth redirect** (not client-side ID-token). The callback can't read localStorage, so the backend must complete the flow + redirect with the token in the URL.

## 7. Super-admin endpoints missing CRUD/method mismatches surfaced by FE clicks

- **Symptom**: Multiple super-admin pages 404'd or 405'd (admins CRUD, promo PATCH, error-log DELETE/resolve, ai/chat GET, feature-flags GET detail, tickets GET detail, performance, billing overview).
- **Root cause**: FE was ported from legacy expecting endpoints that the Go backend hadn't migrated yet. Method mismatches (FE sent PUT, Go expected PATCH) + missing routes.
- **Fix**: Migrated each endpoint after the FE surfaced the gap.
- **Prevention rule**: **When the FE calls an endpoint, verify the Go route exists AND the method matches.** Click every button in the browser — a 404/405 is a gap the unit tests won't catch.

## 8. `config.go` didn't load Midtrans/Google/AI keys (no fields)

- **Symptom**: Midtrans checkout + Google OAuth couldn't access keys even after `.env` was set.
- **Root cause**: `Config` struct only had Port/DatabaseURL/JWTSecret/Environment. No fields for third-party keys.
- **Fix**: Added MidtransServerKey/ClientKey/Env, GoogleClientID/Secret/RedirectURI/WebOrigin, AIKey/Model/BaseURL to Config + `getEnv` loading.
- **Prevention rule**: **When adding a third-party integration, add the config fields** — the Config struct is the single source of truth for env-loaded settings.

## 9. Orders module test panicked (`Module` built without `db` field)

- **Symptom**: `go test ./internal/modules/orders` panicked with nil pointer after adding planlimits.
- **Root cause**: The test built `Module{svc: ...}` directly (no `db`), then the `planlimits.Check` call dereferenced `r.db` (nil).
- **Fix**: Guarded the limit check with `if r.db != nil`.
- **Prevention rule**: **When a module struct gains a new field used in a handler, update or guard the test's Module construction** — `db != nil` guard is the safest pattern for test-only mocks.

## 10. AI chat returned a stub reply (no provider wired)

- **Symptom**: Super-admin AI assistant always returned "not yet wired up."
- **Root cause**: Handler returned a hardcoded string — no provider call.
- **Fix**: Gated on `AI_API_KEY`: when set, calls OpenAI-compatible `/chat/completions`; streams the FE's SSE protocol (`data:{type:"delta"}…[DONE]`). When unset, config returns `enabled:false` (FE disables the input).
- **Prevention rule**: **Gate optional integrations on env keys** — the handler should work when the key is present + degrade gracefully when absent. `aiChatConfig` reflects `enabled` so the FE can hide the feature.

## 11. `GET /api/auth/session-version` 405'd — FE polled an endpoint BE only POSTed

- **Symptom**: Console spam `GET /api/auth/session-version 405 Method Not Allowed` every 60 s + on every window focus.
- **Root cause**: The FE (`useSessionSync`) GETs `/api/auth/session-version` to detect admin-triggered permission reloads. Go registered only `POST /session-version` (`bumpSessionVersion`) — no GET handler. chi returns 405 for the method mismatch. The 405 was silently swallowed client-side, so the feature quietly never worked; it also consumed the `/api/auth` rate-limit bucket.
- **Fix**: Added `r.Get("/session-version", m.getSessionVersion)` + a `getSessionVersion` handler that returns the caller's current `sessionVersion` (read accessor `GetSessionVersion` on the service + repository; `sessionVersion` was already a column on `User`). Bumping (POST) stays non-destructive-read-free.
- **Prevention rule**: **When the FE calls an endpoint, verify the Go route exists with the matching method.** A GET vs POST mismatch surfaces as 405, which the FE's generic catch swallows — silent feature death. Cross-check each FE `apiFetch` call against the `r.Route` registration (path + method).
