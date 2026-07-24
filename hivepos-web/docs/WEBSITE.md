# Website

## Sitemap
Public marketing routes (`hivepos-web/app/`):
- `/` — landing (hero, features, pricing `#harga`, FAQ, final CTA). Primary conversion: register trial.
- `/register` — 60-day Pro trial signup (+ Google OAuth). **Funnel exit.**
- `/login` — returning users.
- `/demo` — email-gated sandbox (secondary, no nurture).
- `/blog`, `/blog/[slug]` — editorial blog (SEO).
- `/alternatif-{moka-pos,olsera,majoo,pawoon,iseller,kasir-pintar,qasir}-laundry` — 7 competitor-comparison SEO pages.
- `/terms`, `/track/[orderNumber]`, `/(public-service)/pickup/[branchSlug]`, `/(public-service)/support`, `/tenant-site` — service/legal.

## Page Briefs
### / (home)
- Purpose & primary conversion action: convince UMKM laundry owner → click "Mulai Gratis" → `/register`.
- Message (from POSITIONING.md, TBD Phase 3): slogan "Kasir laundry, tinggal buka browser." One-liner: "Kasir laundry ringan di browser, untuk UMKM Indonesia."
- CTA (direct + transitional): direct "Mulai Gratis" / "Coba Pro Gratis" (→/register); transitional "Lihat Demo" (→/demo).
- Copy blocks: hero (real POS preview), features, pricing (#harga), FAQ, FinalCTA.

### /alternatif-*-laundry (blocked artery — 7 pages)
- Purpose: capture high-intent "alternatif X" comparison searchers → convert to hivePOS.
- CTA: **weak/unclear** — no prominent "why hivePOS wins" recap → register path. (Audit finding.)
- Copy blocks: comparison table, feature parity, hivePOS advantage.

### /register
- Purpose: complete signup (60-day Pro trial).
- Friction: requires tenant + owner + branch fields in one step (consider micro-commitments — Phase 5).

## Conversion Elements
Objection / Counter-Objection (qualitative, Phase 1 — sourced from principles + UMKM context + dogfooding; refine with real research later):

| Objection (Big 5) | Counter | Placement | Status |
|---|---|---|---|
| No social proof — "is this real or a side project?" | Real customer testimonials/logos/review count (gather first — only dogfooding exists now) | hero, pricing, alternatif pages | pending (EXP-001) |
| "Can it handle my volume?" | Concrete scale proof (own laundry: 443 pelanggan, 199 order) — currently buried in BetaPartnerCTA | hero / dedicated proof section | pending |
| "Why pay vs Free?" | Anchor Free→Growth value (unlimited outlets/staff/orders) + 60-day Pro trial (risk-free) | pricing section | pending |
| Setup/tech fear ("tanpa install" claimed but unproven) | "2 menit live" step-by-step + demo CTA | hero, post-pricing | pending |
| Indonesian UMKM data-trust / "aman?" | Mention browser-based, no install, data ownership | footer/trust row | pending |

## Audit Findings
| Issue | Severity (0-4) | Fix | Status |
|---|---|---|---|
| No analytics — funnel invisible | 4 | Phase 0: GA4 + register conversion event | awaiting-evidence (needs GA ID) |
| No mid-funnel lead capture (register-or-leave) | 4 | Phase 2: scorecard/quiz capturing email before Q1 | pending |
| Proof is self/dogfooding only | 3 | EXP-001: gather + surface real testimonials/logos/reviews | pending |
| `/alternatif-*` pages: weak/absent register CTA | 3 | EXP-002: "why hivePOS wins" recap + prominent register CTA | pending |
| Hero proof below the fold | 2 | Move a trust signal above the fold | pending |
| Pricing: no cost anchor vs competitor per-user pricing | 2 | "Per outlet, bukan per user — kompetitor charge per user" anchor | pending (EXP-004) |
| `/demo` captures email but no nurture sequence | 2 | Phase 2/8: wire demo-email into nurture | pending |

## Lead Capture
*Phase 2 will author the scorecard/quiz funnel here. Current state: register form only — no lead magnet, no nurture.*

## CRO Audit (2026-07-24)

Scored against the cro-methodology Quick Diagnostic (7 rows, ~1.4 each). **Score: 6/10** — structurally sound, but objections are still guesses and proof is single-source.

| # | Diagnostic row | Pass? | Note |
|---|----------------|:----:|------|
| 1 | ONE clear action | ✅ | every CTA → `/register`; no competing goal |
| 2 | Researched why visitors don't convert | ❌ | **zero VOC** — every objection below is a hypothesis, not a finding |
| 3 | O/CO table placed at friction | ⚠️ | table lives here in the doc; counters not yet placed on the page at the friction points |
| 4 | Value prop clear <5s | ✅ | "Kasir laundry, tinggal buka browser" — instant |
| 5 | Persuasion assets visible | ⚠️ | single self-source (dogfooding 443 pelanggan / 199 order); no 3rd-party testimonials, logos, reviews, awards |
| 6 | Funnel mapped for blocked arteries | ✅ | `/alternatif-*` identified as blocked artery; GA4 live (`G-7W9B8ZH5L1`) collecting baseline |
| 7 | Path free of UX blockers | ✅ | 4-field register form, no CC, no captcha, Google OAuth |

**Failing rows: 2 (research), 5 (proof), 3 (O/CO placement).** Until row 2 closes, every copy change rests on opinion — the methodology forbids this.

### Objection / Counter-Objection (Big 5) — evidence vs hypothesis

Each counter tagged so we can see which rest on real data and which are unvalidated guesses:

| Objection | Counter (current/planned) | Tag |
|-----------|---------------------------|-----|
| Trust — "is this real or a side project?" | dogfooding stats 443 pelanggan / 199 order on-page | `[EVIDENCE]` |
| Fit — "will it work for MY laundry?" | "cuma untuk laundry 1–5 outlet" positioning + Honey Bee real orders | `[EVIDENCE]` |
| Price — "worth it / hidden fees?" | "per outlet bukan per user" + 60-day Pro trial + no CC + free-forever 1 outlet | `[EVIDENCE]` |
| Effort — "too hard to set up?" | "Live dalam 2 menit" 3-step How It Works section | `[HYPOTHESIS]` — 2-min claim unproven by visitors |
| Timing — "why now?" | "Mulai hari ini, bukan bulan depan" final CTA | `[HYPOTHESIS]` — no cost-of-delay math, no genuine urgency |

### Research instrument (closes row 2)

Exit-intent survey shipped alongside this audit (`components/exit-intent-survey.tsx`, mounted in `app/layout.tsx`). One question, Big-5 buckets + free-text "lainnya" + optional email:

- **Primary signal → GA4** event `exit_survey_submitted { objection_bucket, has_detail, has_email }`. After ≥1 week the bucket distribution names the #1 real objection → the next counter to build. This converts the `[HYPOTHESIS]` rows above into `[EVIDENCE]` or cuts them.
- **Free-text + email → `/api/public/tickets`** (anonymous, existing endpoint, no backend change). CS-readable; becomes a testimonial source for EXP-001.
- Cooldown 14d after dismiss; never re-show after submit; marketing routes only (`/`, `/alternatif*`, `/blog*`, `/demo`).

ponytail: anonymous free-text with no email is not persisted (GA4 param only, ≤100 chars). If that loss proves costly, add a dedicated `/public/survey-responses` endpoint (`/feature` follow-up, gated on real volume).
