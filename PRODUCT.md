# Product

## Register

product

## Users

Owners and counter staff of small-to-mid laundry businesses (UMKM) across Indonesia. They run the till from a phone or a single shop laptop, often mid-shift, in a noisy, physical environment — folding machines, customers waiting, wet hands. Most are not technical; many manage the books by hand today. Their job-to-be-done on the dashboard: in under 10 seconds know "is today healthy, what needs my attention right now, what's late or unpaid." Counter staff (employees) never see this dashboard — they land in the orders screen. This surface is for the owner-operator deciding and acting.

## Product Purpose

hivePOS is a browser-based laundry point-of-sale and operations SaaS: take orders, track them through the wash pipeline, collect payment, watch the money and the stock, follow up via WhatsApp. The dashboard is the owner's morning-coffee and end-of-day view — the single screen that answers "how's the business doing" and surfaces the handful of things that need action (unpaid orders, low stock, overdue SLA, slow turnaround). Success = the owner trusts it enough to stop opening a spreadsheet.

## Brand Personality

Calm, concrete, quietly competent. Bahasa Indonesia first (casual-professional; "Anda" for CTAs). Anti-bloat is the personality: "tanpa ribet, tanpa install." Three words: **tenang, jelas, ringan** (calm, clear, light). The dashboard should feel like a trusted assistant handing you a one-page briefing — not a cockpit. Indigo is the committed brand hue; color carries meaning (emerald = money/ready, amber = urgent, red = overdue/danger), never decoration.

## Anti-references

- Bloated Indonesian SaaS dashboards with 12 graphs on first load and a learning curve — we show a briefing, not a cockpit.
- Generic SaaS "hero-metric template" walls: big number + small label + gradient + supporting stats repeated identically across cards. We have one focal hero (omset), the rest stay restrained.
- Cream/sand warm-neutral body backgrounds (the saturated AI default) — our surfaces are clean near-white / dark slate, not parchment.
- Buzzwords, growth-hacker copy, competitor name-drops. Concrete units only ("Rp 49K/outlet", "2 menit").
- Decorative motion. Motion conveys state (refresh spin, overdue pulse, reveal) — nothing choreographed on load.

## Design Principles

1. **Briefing, not cockpit.** The owner should answer "what needs me" in one glance. One focal metric earns the hero surface; everything else is restrained support. Progressive disclosure hides depth (collapsible sections) until asked for.
2. **Color is meaning, repeatable.** Same hue = same concept everywhere (ready is always emerald, in the pipeline stage AND the stat tile). Never invent a new color for a new card.
3. **Concrete over abstract.** Real currency, real counts, real hours. No vanity metrics. If a number can't drive a decision, it doesn't earn screen space.
4. **Calm authority.** Quiet motion, generous spacing, consistent component vocabulary. The tool disappears into the task; the owner trusts it because nothing jumps or surprises.
5. **Earned familiarity.** Standard product affordances (side nav, cards, badges, tooltips). Don't reinvent the button or the modal for flavor — familiarity is the feature for a non-technical user.

## Accessibility & Inclusion

- WCAG AA contrast (≥4.5:1 body, ≥3:1 large/text). Text-on-tint verified for every semantic chip (white-on-indigo, white-on-emerald, etc.) in both light and dark.
- `prefers-reduced-motion` respected — every animation has a static fallback; reveal animations never gate content visibility.
- Color is never the only signal (overdue = red tint + badge + optional pulse; high-intensity heatmap gets a hatched pattern for colorblind users).
- Touch targets ≥44px on mobile; no text below 14px on small screens.
- Bilingual (`en` + `id`) — every string via `t()`; locale-aware dates/currency.
