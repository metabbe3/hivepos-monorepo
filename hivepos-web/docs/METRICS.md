# Metrics

## Funnel
Stages (qualitative map; drop-off = **unknown — no analytics yet**):

| Stage | Entry | Exit | Drop-off | Benchmark | Bottleneck? |
|---|---|---|---|---|---|
| 1. SEO/entry | `/alternatif-*`, `/blog`, organic | `/` or `/alternatif-*` bounce | unknown | TBD | hypothesis: alternatif bounce high |
| 2. Landing | `/` | scroll to CTA / leave | unknown | ~40-60% scroll-to-CTA (industry) | TBD |
| 3. CTA click | `/` "Mulai Gratis" | `/register` | unknown | TBD | TBD |
| 4. Register complete | `/register` submit | signup (trial) | unknown | 2-5% of landing (SaaS trial) | TBD |

**Blocked artery (hypothesis):** `/alternatif-*` pages — 7 high-intent SEO pages with no measured/strong path to `/register`. Validate once analytics lands.

**One Metric (lean-analytics):** *Register-trial completion rate* (signups / sessions). Currently unmeasured. Secondary: landing→/register click-through; alternatif→register conversion.

## Baselines & Targets
*Pending analytics (Phase 0). Fill after ≥1 week of data.*

| Metric | Baseline (TBD) | Target | Notes |
|---|---|---|---|
| Sessions / month | TBD | — | from GA4 |
| Landing→/register CTR | TBD | +50% post EXP-001/002 | |
| Register completion rate | TBD | 3%→5% | |
| Alternatif bounce rate | TBD | <60% | |
| Retention / LTV | TBD | Phase 8 | retention 5%↑ = profit 25-95%↑ |

## Instrumentation (Phase 0)
- Provider: GA4, env-gated via `NEXT_PUBLIC_GA_ID` (no-op if unset). Code: `app/layout.tsx` + `lib/analytics.ts`.
- Events: pageview (auto), `register_trial_started` (on register CTA click/submit), `demo_started`, `alternatif_cta_click`.
- **Blocker:** needs `NEXT_PUBLIC_GA_ID` from user (or switch to Plausible).
