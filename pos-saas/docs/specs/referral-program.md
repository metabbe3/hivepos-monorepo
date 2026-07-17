# Feature Spec — Referral Program

> **Status:** Shipped (v1) · **Last updated:** 2026-07-02
> **Flag:** `referralProgram` (default **on**) · **Related code:** `lib/referrals.ts`, `prisma/schema.prisma` (`Referral`, `Tenant.referralCode`)
> Template: [`docs/specs/_TEMPLATE.md`](./_TEMPLATE.md)

---

## 1. Overview & Problem
hivePOS grows cheapest through UMKM word-of-mouth — laundry owners talk to other laundry
owners. A referral program turns that into a structured growth lever: an owner shares a link,
and when the referred laundry starts paying, **both sides get a free outlet-month**.

The hard problem is **fraud**: "create a new account just to farm the free month." This spec's
central design decision makes that economically irrational and fully logged. The reward is
granted on the referred tenant's **first real paid payment**, not at signup.

## 2. Users & User Stories
- **As a laundry owner (referrer)**, I want a shareable link, so that I get a free month when a
  peer I invite starts paying.
- **As a laundry owner (referred)**, I want my friend's link to give me a free month on my first
  payment, so I'm incentivized to use it.
- **As the platform operator (super-admin)**, I want a ledger of every referral + the ability to
  void abuse, so the program can't bleed money unnoticed.

## 3. Scope
**In (v1):** unique referral code per tenant; `?ref=` capture at register; reward (1 outlet-month
to **both** sides) on the referred tenant's first PAID `SaaSPayment`; anti-abuse (self-referral
block, per-referrer cap, flag kill-switch); super-admin ledger + void; owner referral card on
`/billing`; audit log of every grant/void.

**Out (follow-ups):** tiered/multi-tier rewards, cash payouts, referral email notifications,
referrer leaderboards, marketing assets.

## 4. Functional Requirements
- **FR-1** Every tenant has a unique `referralCode` (8-char base36), generated at register and
  backfilled for existing tenants.
- **FR-2** `/register?ref=CODE` links the new tenant to the referrer; an invalid code is ignored
  (registration still succeeds).
- **FR-3** A `Referral` record is created at register with status `PENDING` (or `REJECTED`).
- **FR-4** The reward unlocks **only** when the referred tenant's **first** `SaaSPayment` is
  marked `PAID` (Midtrans webhook).
- **FR-5** On reward, both the referrer's and the referred tenant's **first active branch** get
  `+1` month of coverage.
- **FR-6** Owners can copy their share link from `/billing`.
- **FR-7** Super-admin can list all referrals and void any (`/super-admin/referrals`).
- **FR-8** The whole program is gated by the `referralProgram` feature flag.

## 5. Non-Functional Requirements
- **Security / anti-abuse:** self-referral blocked on `ownerEmail` **or** `ownerPhone` match;
  reward is payment-gated (a fake account must pay Rp 49K to trigger a Rp 49K reward = net zero);
  per-referrer cap `REFERRAL_CAP = 12`; every grant/void audit-logged.
- **Reliability:** the reward path is **best-effort** — it never throws (payment confirmation is
  never blocked by a referral failure; the reward can be granted manually from the ledger).
- **Performance:** reward runs in one transaction after payment confirmation; owner API is one
  cheap PK read + a count.
- **Deploy:** schema change (`Referral` table + `Tenant.referralCode`) ⇒ rebuild **both** Docker
  images (`app` + `init-db`) per the QA gate; backfill existing codes.

## 6. Data Model (`prisma/schema.prisma`)
- `Tenant.referralCode String? @unique` — the share code.
- **`Referral`** — `id`, `referrerId` (Tenant), `referredId` (Tenant, **`@unique`** → one
  referrer per tenant), `status`, `rewardMonths` (default 1), `reason`, `createdAt`, `rewardedAt`;
  `@@index([referrerId, status])`; cascade delete on both relations.

**Status state-machine:**
```
                 register (?ref valid, identity differs)
   (none) ──────────────────────────────────────────────► PENDING
                                                              │
                                 first PAID payment, under cap │  over cap
                                     ┌─────────────────────────┘  ───────► EXPIRED
                                     ▼
                                 REWARDED
   register (?ref, same email/phone) ──► REJECTED        super-admin void ──► REJECTED
```

## 7. API Surface
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/register` (body `referralCode`) | public | captures `?ref`; generates the new tenant's own code; `attachReferral` |
| GET | `/api/tenant/referral` | tenant (`billing:read`) | own code + share link + reward stats |
| GET | `/api/super-admin/referrals` | super-admin | the ledger |
| PATCH | `/api/super-admin/referrals/:id` | SUPER_ADMIN | void (→ REJECTED), audit-logged |
| — | Midtrans webhook → `maybeRewardReferral` | (signed) | the reward trigger |

- **Client UI:** owner card `components/billing/referral-card.tsx` (mounted on `/billing`);
  super-admin `app/super-admin/(panel)/referrals/` (+ sidebar entry, `Gift` icon).
- **Core logic:** `lib/referrals.ts` — `generateUniqueReferralCode`, `attachReferral`,
  `maybeRewardReferral`, `ensureReferralCode`, `getReferralStats`; constants `REFERRAL_CAP`,
  `REWARD_MONTHS`. **Backfill:** `prisma/seed-referral-codes.ts`.

## 8. Acceptance Criteria *(pass/fail for code verification)*
Each is independently testable; these mirror the e2e proof already run.

- **AC-1 (self-referral rejected)** — *Given* a referrer with code C and email E, *when* a new
  tenant registers with `?ref=C` and ownerEmail E (or a matching phone), *then* a `Referral` is
  created with `status=REJECTED`, `reason=self_referral`, and it can **never** reward.
- **AC-2 (no payment → no reward)** — *Given* a `PENDING` referral, *when* the referred tenant
  has zero PAID payments and `maybeRewardReferral` runs, *then* the referral stays `PENDING` and
  **no** coverage is extended.
- **AC-3 (first paid payment rewards both)** — *Given* a `PENDING` referral, *when* the referred
  tenant's **first** `SaaSPayment` is marked PAID and `maybeRewardReferral` runs, *then* the
  referral becomes `REWARDED`, both tenants' first active branch gain `+1` month coverage, and an
  `auditLog` row (`referral.reward`) is written.
- **AC-4 (second payment is a no-op)** — *Given* a `REWARDED` referral, *when* a later payment
  is confirmed, *then* nothing changes (idempotent — no double reward).
- **AC-5 (cap enforced)** — *Given* the referrer already has `REFERRAL_CAP` (12) `REWARDED`
  referrals, *when* another referral's first payment lands, *then* that referral becomes
  `EXPIRED` (`reason=over_cap`) and **no** reward is granted.
- **AC-6 (flag kill-switch)** — *Given* `referralProgram` is off for a tenant, *when* a first
  payment lands, *then* `maybeRewardReferral` returns immediately with no side effects.
- **AC-7 (share link is public)** — *Given* an owner, *when* they open `/billing`, *then* the
  referral card shows a copyable link of the form `${NEXTAUTH_URL}/register?ref=CODE`.
- **AC-8 (super-admin oversight)** — *Given* a super-admin, *when* they open
  `/super-admin/referrals`, *then* they see every referral (status, referrer, referred, reason)
  and can void any `PENDING`/`EXPIRED` entry (audited).

## 9. Relations to other functions
| Function | Relation | Touchpoint |
|---|---|---|
| **Billing** | depends on (reward = coverage extension) | `lib/billing.ts` → `extendOutletCoverage(tx, tenantId, branchIds, months)`, `addMonths` |
| **Billing** | triggered by (first paid payment) | `modules/billing/application/handle-webhook.service.ts` → calls `maybeRewardReferral` after `markPaymentPaidAndRecompute` |
| **Billing** | reads (first-payment gate) | `SaaSPayment` count where `status="PAID"` |
| **Registration** | captures the referrer | `app/api/register/route.ts` (generates code + `attachReferral` in the tx); `app/(auth)/register/page.tsx` (`?ref`) |
| **Audit log** | writes every grant/void/expiry | `lib/audit.ts` `auditLog(...)` — actions `referral.reward`, `referral.expired`, `referral.void`; actor `system@hivepos.id` |
| **Feature flags** | gates the program | `referralProgram` in `lib/feature-flags.ts` `FLAG_KEYS` + `prisma/seed-flags.ts`; resolved via `resolveFlag` |
| **Super-admin panel** | oversight surface | `app/super-admin/(panel)/referrals/`, sidebar (`components/layout/super-admin-sidebar.tsx`) |
| **Public surface** | the share destination | `/register` (landing register flow); grows the tenant base |

## 10. Test Plan / QA Gate (maps to `docs/sop/qa-verification.md`)
- **Unit/logic:** the anti-abuse decisions live in `lib/referrals.ts` — a throwaway e2e script
  already proved AC-1…AC-3 (PENDING on attach, REJECTED on self-referral, gate holds at 0
  payments, reward on first PAID +1 month both sides + audit row). Convert to a permanent
  `lib/referrals.test.ts` (mocked or test-DB) as the regression guard.
- **Type/build:** `npx tsc --noEmit` + `npm run build` (routes `/api/tenant/referral`,
  `/api/super-admin/referrals[/:id]`, `/super-admin/referrals` present).
- **Schema:** `npm run db:push` applies cleanly; `npx tsx prisma/seed-flags.ts` adds the flag;
  `npx tsx prisma/seed-referral-codes.ts` backfills codes.
- **Manual/Playwright:** owner `/billing` → card + copyable `NEXTAUTH_URL` link (AC-7);
  super-admin `/super-admin/referrals` → ledger renders + void (AC-8); register `?ref=CODE`
  → a `PENDING` referral appears in the ledger.
- **Docker:** schema changed ⇒ rebuild **both** images (`docker compose build app init-db &&
  docker compose up -d`) + browser/PWA hard-refresh.

## 11. Rollout & Rollback
- **Rollout:** deploy code → `db:push` (or let `init-db` apply) → `seed-flags` + `seed-referral-codes`
  → rebuild both images → force-update installed PWAs (super-admin → Settings → *Force Update All
  PWAs*). Flag is on by default; dogfood on one tenant first by setting a per-tenant override off.
- **Rollback (instant, no deploy):** flip `referralProgram` off globally (super-admin → Feature
  Flags). No new rewards accrue; existing `REWARDED` coverage stays (no claw-back in v1).
  Hard-kill: also void suspicious entries from the ledger.

## 12. Metrics / Success Criteria
- Referrals created per week; **signup → first-PAID conversion** of referred tenants (the signal
  that referrals bring *paying* laundries, not dead signups).
- Total reward cost (outlet-months granted × Rp 49K) vs. new paying-MRR acquired — keep the
  program net-positive.
- **Fraud rate** = `REJECTED` (self-referral) + `EXPIRED` (over-cap) + voided, as a % of
  rewards. Investigate if it rises.

## 13. Risks & Mitigations
| Risk | Mitigation (in place) |
|---|---|
| Self-referral / fake-account farming | Reward on first PAID payment (net-zero to farm) + email/phone self-referral block (AC-1) |
| Reward cost runaway | Per-referrer cap `REFERRAL_CAP=12` (AC-5) + flag kill-switch (AC-6) |
| Reward path failure breaks payments | Best-effort: `maybeRewardReferral` never throws; manual grant from the ledger |
| Operator doesn't notice abuse | Super-admin ledger + `auditLog` on every grant/void/expiry |
| Stale link origin behind Docker | Share URL uses `NEXTAUTH_URL`, not `req.url.origin` |

## 14. Open Questions / Follow-ups
- Tiered rewards (more rewards for high-converting referrers)? — out of v1.
- Notify the referrer when their reward lands (email/WhatsApp)? — follow-up.
- Claw-back a reward if the referred tenant refunds/chargebacks? — v1 does **not** claw back;
  add if refund volume grows.
- Promote the program on the landing growth section + in-app banner? — marketing follow-up.
