# Lessons Learned — hivepos-web (Next.js frontend)

Append-only ledger of bugs shipped + root causes + prevention rules. Read before claiming any task "done." Each entry: **Symptom → Root cause → Fix → Prevention rule**.

## 1. apiFetch double-`/api` prefix → dashboard + data screens all 404

- **Symptom**: Dashboard stats, orders list, services — every `/api/*` call 404'd. The app appeared completely broken.
- **Root cause**: 58 call sites pass paths starting with `/api/...` (e.g., `/api/dashboard/stats`). `apiFetch` prepends `BASE` which is `http://localhost:8099/api` → result: `…/api/api/dashboard/stats` (double `/api`). Only `auth-client` used bare paths (`/auth/login`).
- **Fix**: Added a dedup at the `apiFetch` chokepoint: `if BASE.endsWith("/api") && path.startsWith("/api/") → slice(4)`. One edit, both conventions work.
- **Prevention rule**: **Normalize at the chokepoint, not at every call site.** When two conventions collide (58 sites vs 2), fix the 1 shared function. Test: `curl` the exact URL the browser sends.

## 2. FE expected legacy `{plans:[]}` wrappers but Go returns bare arrays → empty lists

- **Symptom**: Plans page showed "No plans yet" despite DB having 4 plans. Promo-codes, blog, feature-flags all empty.
- **Root cause**: The port copied the legacy FE code which read `r.data.plans` / `r.data.promoCodes` / `r.data.posts` (NextAuth envelope shape). Go returns bare arrays: `{success:true, data:[...]}` → `r.data` IS the array → `r.data.plans` = `undefined` → `setPlans([])`.
- **Fix**: Changed each FE fetch to `apiFetch<T[]>(url).then(r => setData(r.data ?? []))` (bare array, no wrapper key).
- **Prevention rule**: **Go list endpoints return bare arrays.** The FE reads `r.data` directly. If you see `{key: [...]}` in a fetch, that's a legacy wrapper — strip it. Check the actual Go response with `curl` + compare JSON shape.

## 3. `writeRows` endpoints return `{rows, page, hasNext}` not bare arrays

- **Symptom**: Billing payments table crashed with `rows.map is not a function`. Tickets + error-logs had the same risk.
- **Root cause**: Some Go handlers use `writeRows(w, list, total, filter)` → returns `{rows:[...], page, hasNext}`. Other handlers use `apphttp.Success(w, list)` → bare array. The FE must read `.rows` for the former + `.data` for the latter.
- **Fix**: Check which Go function the endpoint uses (`writeRows` vs `Success`) + read the right field.
- **Prevention rule**: **`writeRows` ≠ `Success(list)`.** Before consuming a list endpoint, check whether the Go handler calls `writeRows` (→ `{rows}`) or `Success(list)` (→ bare array). The error `rows.map is not a function` is the symptom of this mismatch.

## 4. Server components calling client-only stubs crashed (tickets, billing, error-logs, settings, peripherals, pickup-insights)

- **Symptom**: Pages showed the error boundary ("Terjadi Kesalahan"). Console: `TypeError: Cannot read properties of null (reading 'filter')`.
- **Root cause**: Server components (`async function Page()`) called stubbed libs (`getTickets`, `getBillingOverview`, `getPickupInsights`) that returned `null as any` or used `apiFetch` (which reads localStorage → unavailable server-side). The `.filter()` on null crashed.
- **Fix**: Converted each page to a client component (`"use client"`) + replaced the stub call with `apiFetch` in `useEffect`. Pattern: `useState` → `useEffect(apiFetch)` → render.
- **Prevention rule**: **Server components must not call `apiFetch` or any client-only stub.** `apiFetch` reads `localStorage` for the JWT token — that's unavailable during SSR. If a page needs auth-driven data, it's a client component. When porting, check: does the page's lib function use `apiFetch` or `localStorage`? If yes → `"use client"`.

## 5. Hydration mismatch on orders page (session-driven role-gated UI)

- **Symptom**: Console: "Hydration failed because the server rendered HTML didn't match the client." Specifically the orders page sort/filters row diverged.
- **Root cause**: `useSession()` uses a module-level store (`currentSession`, `currentStatus`) that leaks across SSR requests. On the server, the store might have a previous request's authenticated session → `isEmployee=false` → filters rendered. On the client first render, status="loading" → `isEmployee=true` → filters hidden. Mismatch.
- **Fix**: Added a `mounted` guard: `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), []); if (!mounted) return <loadingShell/>`. Server + first client render are identical (both show the shell); real UI appears after mount.
- **Prevention rule**: **Session/role-driven pages need a `mounted` guard.** Any UI that branches on `isEmployee`, `useSession().status`, or `session?.user` should not render during SSR. Pattern: gate on `mounted`; show a consistent shell until mount.

## 6. `router.refresh()` didn't update client `useState` → mutation appeared to fail

- **Symptom**: Suspend/reactivate a tenant → the button didn't flip. Create a plan → list didn't update. Admin create → list didn't refresh. But the data WAS saved (verified via DB).
- **Root cause**: The FE mutation handlers called `router.refresh()` after the API call. `router.refresh()` re-renders Server Components — but the data was in `useState` (client state). `router.refresh()` does NOT re-run `useEffect` fetches or update `useState`. So the list stayed stale.
- **Fix**: Threaded a reload callback (`onMutated`) from the data-owning parent to the action component. After a successful mutation, call `onMutated()` → parent re-fetches.
- **Prevention rule**: **`router.refresh()` is a no-op for client `useState` data.** When a page holds data in `useState` (client component + `useEffect` fetch), mutations must call a reload function, not `router.refresh()`. Pattern: `const reload = useCallback(fetchFn, [deps]); <Child onMutated={reload} />`.

## 7. Midtrans "nothing opened" — `data.snapToken` was `undefined`

- **Symptom**: Clicking Pay on billing did nothing. No popup, no error. Network showed the checkout call succeeded (201).
- **Root cause**: BE returned `{token, redirectUrl}` but the FE read `data.snapToken`. The field name didn't match → `undefined` → the `if (data.snapToken && window.snap)` guard failed → fell through to a "preparing" toast (barely noticeable).
- **Fix**: BE `CheckoutResult` JSON tags changed to `{status, snapToken, redirectUrl, message}`. Also added a Snap-Redirect fallback in the FE: if `snapToken` present but `window.snap` undefined (snap.js blocked/slow), open `redirectUrl` in a new tab.
- **Prevention rule**: **After wiring a payment/auth flow, click the button in the browser.** A silent failure (no popup, no error) usually means a field-name mismatch or a guard that fails silently. Always add a fallback path (Snap Redirect works without snap.js).

## 8. Billing total showed Rp 200.000 instead of Rp 196.000 (hardcoded 50000 vs Plan 49000)

- **Symptom**: Billing page displayed the wrong total. User noticed "Growth Rp 50.000/outlet" but the plan was 49.000.
- **Root cause**: BE status handler hardcoded `Pricing{50000}`. FE `unitPrice` used `status.pricing.unitPrice` (50000) for Growth. The checkout amount (charged via Midtrans) used `plan.Price` (49000) → display ≠ charge.
- **Fix**: BE fetches Growth/Pro prices from the Plan table. FE reads `status.growthPrice`/`proPrice` (data-driven, no literals).
- **Prevention rule**: **Display prices must match charge prices.** If a total is computed from `unitPrice`, that `unitPrice` must come from the same Plan row the checkout uses. Never hardcode a price that an admin can configure.

## 9. Google button visible but `signIn("google")` redirected to a stub backend

- **Symptom**: "Masuk dengan Google" button appeared (NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true) but clicking did nothing — redirected to a backend endpoint that returned a mock.
- **Root cause**: FE `signIn("google")` → `window.location.href = BASE/auth/google`. But the Go route was `POST /google` (not GET), and the handler returned `{"token":"mock-google-jwt"}`.
- **Fix**: BE: added `GET /google` (redirect to consent) + `GET /google/callback` (exchange + userinfo + JWT). FE: added `googleToken` capture on the login page `useEffect` (reads from URL after the backend redirect).
- **Prevention rule**: **OAuth flows need GET (browser redirect), not POST.** The FE does `window.location` → the backend must accept GET. The callback must complete the flow server-side + redirect back to the FE with the token in the URL (since localStorage isn't accessible during a redirect).

## 10. Promo-codes toggle/edit used wrong method + path → 405

- **Symptom**: Clicking toggle (activate/deactivate) on a promo code → 405 Method Not Allowed. Edit → same.
- **Root cause**: FE sent `PATCH /api/super-admin/promo-codes` (collection URL, with id in body) for toggle, and `PUT /api/super-admin/promo-codes` for edit. Go route was `PATCH /promo-codes/{id}` (path param, not body). Method + path mismatch.
- **Fix**: FE toggle → `PATCH /api/super-admin/promo-codes/${code.id}` body `{isActive}`. FE edit → same path, method PATCH.
- **Prevention rule**: **REST resource updates target the resource URL (`/{id}`), not the collection (`/`).** The id goes in the path, not the body. Cross-check FE method + path against the Go route registration (`r.Patch("/{id}", ...)`).

## 11. Orders page force-logged-out on a valid session (`reloadSession` cleared the token on an aborted `/auth/me`)

- **Symptom**: On `/laundry/orders`, the user was redirected to `/login` seconds after load, even right after a fresh login. API logs showed `GET /api/auth/me` → 200, then ~8 ms later all calls → 401 (token gone).
- **Root cause**: The orders page re-navigates (URL-state `router.replace`) while `SessionProvider`'s `reloadSession()` `/auth/me` is in flight; the navigation aborts the fetch. `reloadSession`'s `catch` ran `clearAuthToken()` + set `status="unauthenticated"` on **any** error — including the `AbortError`/`TypeError` from the aborted fetch, which is not an auth rejection. `SessionGuard` then redirected to `/login`. A valid token was destroyed by a transient navigation abort.
- **Fix**: `lib/auth-client.tsx` `reloadSession` catch now branches on `e instanceof ApiClientError && (httpStatus === 401 || httpStatus === 403)` → clear + logout only on a real auth rejection. Everything else (abort, 429, 5xx, network blip) leaves the token + session untouched.
- **Prevention rule**: **A transient fetch failure is not a logout.** Any code that clears the session token in an error handler must distinguish "server rejected the token" (401/403) from "request didn't complete" (abort, network, rate-limit, 5xx). Clear only on the former.

## 12. Redeployed fixes never reached the browser — stale service-worker cache (`sw.js` `VERSION="dev"`)

- **Symptom**: After redeploying the #11 fix (confirmed present in the running container's built chunks), the orders-page logout **persisted**. Instrumenting the FE showed the new code never executed in the browser.
- **Root cause**: `public/sw.js` caches the app shell + JS chunks (`hivepos-shell-v<VERSION>` / `hivepos-runtime-v<VERSION>`) and serves **navigations cache-first + chunks stale-while-revalidate**. The cache key is `VERSION`, hardcoded `const VERSION = "dev"` — the `scripts/gen-sw-version.mjs` that the sw.js comment said would inject a build-unique value **did not exist**, and `prebuild` didn't run it. So the cache version never changed across deploys → the SW kept serving the OLD build's HTML + chunks → old (pre-fix) auth code ran in the browser. Every redeploy was invisible to installed clients.
- **Fix**: Added `scripts/gen-sw-version.mjs` (rewrites `const VERSION = "..."` in `public/sw.js` to a build-time-unique value) and wired it into `prebuild` (`npm run gen:contract && npm run gen:sw-version`). Each build produces a new `VERSION` → the new SW activates (`skipWaiting` + `clients.claim`) → deletes old caches → fresh code served. The script fails the build if the placeholder line is missing.
- **Prevention rule**: **A service worker that caches the app shell must version its cache per build.** A constant cache key means redeployed fixes never reach installed clients — the browser runs stale code and you'll chase "ghost" regressions that aren't in your source. Always inject a build-unique cache version; never leave a hardcoded placeholder. When debugging "fix is in the build but the browser doesn't see it," check `navigator.serviceWorker.controller` + `caches.keys()` first.
