# Grow a Website Plan

## Context
First run of the `grow-website` journey on the hivePOS marketing site (**hivepos.id**, code in `hivepos-web/`). Started 2026-07-23.

Intake answers:
- **Site + primary conversion:** hivepos.id → `/register` (60-day Pro trial). `/demo` + WhatsApp are secondary.
- **Pricing (live):** Free Rp0 · Growth Rp49K/outlet·mo · Pro Rp79K/outlet·mo ("per outlet, bukan per user").
- **Analytics:** **none** — zero instrumentation. Funnel is invisible → Phase 0 (instrument) is the enabling step.
- **Visitor research:** **none** — Phase 1 sources objections qualitatively (principles + dogfooding data + UMKM context).
- **Lead capture:** none beyond the register form → Phase 2 not skippable.
- **Positioning:** one-liner + slogan live (`CLAUDE.md`), no brand script → Phases 3–4 needed.
- **Proof:** self/dogfooding only (own laundry: 443 pelanggan, 199 order). No testimonials/logos/reviews.
- **Price objection:** unknown → Phase 6 kept (pending evidence).
- **Traffic volume:** unknown (no analytics) → Phase 1 qualitative-first; quantitative once data lands.
- **SEO asset:** 7 `alternatif-*` competitor-comparison pages (high-intent comparison traffic).

## Phase Status
| Phase | Skill | Status | Artifact | Date |
|---|---|---|---|---|
| 0. Measure (analytics) | lean-analytics | done | METRICS.md, code (app/layout.tsx, lib/analytics.ts) | 2026-07-23 |
| 1. Discover why visitors leave | cro-methodology | in-progress | WEBSITE.md, METRICS.md, EXPERIMENTS.md | 2026-07-23 |
| 2. Capture the not-ready 97% | scorecard-marketing | pending | WEBSITE.md, MARKETING.md | |
| 3. Clarify the message | storybrand-messaging | pending | POSITIONING.md | |
| 4. Make the message stick | made-to-stick | pending | POSITIONING.md, WEBSITE.md | |
| 5. Add proof and triggers | influence-psychology | pending | WEBSITE.md | |
| 6. Rebuild the offer | hundred-million-offers | pending (objection unknown) | OFFER.md, EXPERIMENTS.md | |
| 7. Engineer shareability | contagious | pending | MARKETING.md, WEBSITE.md | |
| 8. Connect the lifecycle | one-page-marketing | pending | MARKETING.md, METRICS.md | |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

**Phase 0 → done:** GA4 live (`NEXT_PUBLIC_GA_ID=G-7W9B8ZH5L1`, inlined at build via Dockerfile ARG + compose build-arg; gtag + `register_trial_started` event confirmed in served HTML). Phase 1 → `in-progress`: collecting baseline. Pageviews + register-conversion now flow to the GA4 property.

Skip-heuristic decisions: Phase 2 NOT skipped (no capture funnel exists). Phase 6 NOT skipped (price-objection unknown). Phase 7 pending (no shareable asset yet — will emerge from Phase 2's scorecard).

## Key Decisions
| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 2026-07-23 | 0 | Instrument with GA4, env-gated (`NEXT_PUBLIC_GA_ID`); no-op if unset | Free, universal, UMKM-Indonesia standard; reversible if Plausible preferred later |
| 2026-07-23 | 1 | Qualitative-first (site is blind); blocked artery = `/alternatif-*` pages | Highest-intent SEO traffic, weakest CTA-to-conversion link; can't measure drop-off yet |
| 2026-07-23 | 1 | Trust/proof = #1 gap (EXP-001) | Site has only self/dogfooding proof; no third-party validation |

## Next Actions
- [ ] Collect ≥1 week GA4 baseline → fill METRICS.md (sessions, landing→/register CR, alternatif bounce, register completion).
- [ ] Run EXP-001 (add real customer proof) + EXP-002 (alternatif→register CTA) to significance over a full business cycle.
- [ ] Resume Phase 2 (scorecard lead capture) once Phase 1 → done.
