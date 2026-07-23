# Experiments

## Experiment Cards

### EXP-001 — Add real customer proof (testimonials / logos / review count)
- **Hypothesis:** We believe register-trial completion will rise if landing + alternatif visitors see third-party proof (testimonials, real customer count, review stars) because trust is the #1 unaddressed objection (site has only self/dogfooding proof today).
- **Type:** A-B (after analytics baseline) — preceded by a gathering sprint (collect 5-10 real testimonials/logos).
- **Primary metric & threshold (pre-committed):** landing→/register CTR, +20% vs baseline.
- **Secondary metric:** register completion rate.
- **Guardrail:** bounce rate (must not increase); page load (proof assets lazy-loaded).
- **Decision rule:** persevere if CTR +20% & significance reached over 1 business cycle; iterate if +5-19%; pivot if ≤+5%.
- **Result & verdict:** — (awaiting analytics + gathered proof)
- **Depends on:** Phase 0 (analytics) + a proof-gathering sprint (only real evidence — no fabricated reviews).

### EXP-002 — Alternatif-page → register CTA + "why hivePOS wins" recap
- **Hypothesis:** We believe alternatif-page→register conversion will rise if each `/alternatif-*` page ends with a prominent "why hivePOS wins" recap + direct register CTA because today these high-intent SEO pages have a weak/no conversion path.
- **Type:** A-B (page-template change across 7 pages).
- **Primary metric & threshold:** alternatif→/register click-through, +50% vs baseline (low starting point).
- **Secondary metric:** alternatif→register completion.
- **Guardrail:** alternatif bounce rate (must not increase); organic ranking (monitor Search Console, no metadata regression).
- **Decision rule:** persevere if alternatif→register +50% & significance; iterate if partial; pivot if neutral.
- **Result & verdict:** — (awaiting analytics)

## Experiment Backlog
| Idea | ICE (impact/confidence/ease) | Status |
|---|---|---|
| EXP-001 real customer proof | 8 / 6 / 7 | queued (needs proof + analytics) |
| EXP-002 alternatif→register CTA recap | 8 / 7 / 8 | queued (needs analytics) |
| EXP-003 mid-funnel lead capture (scorecard capturing email pre-Q1) | 9 / 6 / 5 | backlog → Phase 2 |
| EXP-004 pricing anchor vs competitor per-user cost | 6 / 6 / 8 | backlog |
| EXP-005 micro-commitment register flow (stepwise) | 7 / 6 / 6 | backlog → Phase 5 |
| EXP-006 move trust signal above the fold | 5 / 7 / 9 | backlog |
