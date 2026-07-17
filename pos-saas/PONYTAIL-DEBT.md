# Ponytail Debt Ledger

Every deliberate ponytail shortcut is marked with a `ponytail:` comment naming its
ceiling and upgrade path. This file is the collected ledger so a deferral can't
quietly become permanent.

Regenerate with: `grep -rnE '(#|//) ?ponytail:' .` (excluding `node_modules`,
`.git`, `.next`, `coverage`, `test-results`).

Rows tagged **no-trigger** name no automatic revisit condition — those are the
ones that silently rot and need a manual check.

---

## lib/web-printer.d.ts

- **:11** — optional `watchAdvertisements?` typed loose. ceiling: only Chromium 103+. upgrade: drop the `?` / narrow when Safari/Firefox ship it. **no-trigger**
- **:37** — optional `getDevices?` / `requestWatchAdvertisements?` typed loose. ceiling: Chromium 103+ only. upgrade: move to required when widespread. **no-trigger**

## Dockerfile

- **:7** — stub `DATABASE_URL` to satisfy prisma config loader at generate time. ceiling: prisma generate requires the key present (doesn't connect). upgrade: none — permanent build-time shim, not rot-prone. **no-trigger**

## app/(dashboard)/branches/[id]/page.tsx

- **:93** — `detectBrowser()` UA sniff for a capability badge label. ceiling: regex UA parsing, not security-sensitive. upgrade: switch to user-agent client hints (`navigator.userAgentData`) if badge labels need to be exact. **no-trigger**
- **:288** — auto-scan LAN once on entering edit mode. ceiling: fires a /24 subnet probe per edit-session open (network cost). upgrade: cache results for N minutes if the probe becomes chatty on slow networks.
- **:800** — picking a discovered printer auto-fires a test print. ceiling: one paper-waste per pick (intentional one-step setup). upgrade: add a "skip test print" toggle if owners complain about paper use.

## app/(dashboard)/laundry/orders/[id]/receipt/page.tsx

- **:122** — silent BT reconnect on page load. ceiling: only works for `kind: "bluetooth"` remembered devices on Chromium; serial/network have no silent path. upgrade: add serial auto-reconnect if `navigator.serial.getPorts()` lands broadly / becomes reliable.
- **:151** — shared `buildReceiptData()` builder using `order!` non-null assertions. ceiling: caller guards `if (!order) return` before, so assertion holds today. upgrade: move builder to take `order` as a param if call sites ever skip the guard.
- **:231** — `handleSmartPrint` priority cascade. ceiling: hardcoded method priority (network > bluetooth > serial > browser). upgrade: make priority configurable per-branch if owners want a different default.

## app/api/printers/test/route.ts

- **:22** — SSRF guard removed for the printer test endpoint. ceiling: relies on OWNER role-gate above; a non-owner calling this would bypass. upgrade: re-add a scoped allowlist if the endpoint ever becomes reachable by non-owners (e.g. staff testing their own branch).

## Ad-hoc forms (not on DynamicForm)

- `components/profile/personal-info-card.tsx:3` (anchor for the class) — ceiling: 6 forms use inline validation + per-form i18n keys instead of the canonical `validation.required` + `form.checkForm` path through DynamicForm. Members: `personal-info-card.tsx`, `password-change-card.tsx`, `app/(dashboard)/laundry/orders/new/page.tsx`, `app/(dashboard)/laundry/orders/[id]/page.tsx`, `app/(dashboard)/billing/page.tsx`, `app/(dashboard)/branches/[id]/page.tsx`. All have error+success toasts; regression risk > consistency benefit at present (would lose inline strength meter, password reveal, dynamic line items). upgrade: migrate as a class when DynamicForm supports those features, or when these forms get a UX rewrite for other reasons. **no-trigger**

---

11 markers, 5 with no trigger.

The 5 no-trigger rows are intentional and low-rot: the two `web-printer.d.ts`
ones wait on browser vendors (revisit when Safari/Firefox ship the APIs), the
Dockerfile stub is a permanent build shim, the UA sniff only matters if
badge labels need to be exact, and the ad-hoc-forms class waits on DynamicForm
features (or a UX rewrite) before migration is worth the regression cost.
Nothing silently decaying.
