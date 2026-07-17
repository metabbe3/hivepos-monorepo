---
target: order pages
total_score: 29
p0_count: 2
p1_count: 2
timestamp: 2026-07-05T14-35-00Z
slug: app-dashboard-laundry-orders
---
## Design Health Score: 29/40 (Good)

P0: PER_KG orders can submit with zero weight (Rp 0 orders — no validation in handleSubmit)
P0: List action buttons are 32×32px (WCAG 2.5.5 fail, need 44×44)
P1: Status-tab counts drift from filtered list (4 unfiltered count calls ignore active filters)
P1: Draft-recovery modal blocks page on every return visit
P2: Service-tile interaction inconsistent (role=button for single-variant, plain div for multi-variant)
P3: 6 icon actions per row, no undo on delete

Strengths: URL-backed filter state, offline-first order path, status timeline component.
Detector: CLEAN (0 findings).
