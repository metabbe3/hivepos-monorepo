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
