# Product

## Register

product

Dual-register project. The **product app** — `(dashboard)`, `super-admin`, order tracking — is the primary default; future `/impeccable` commands load `reference/product.md` unless told otherwise. The **brand surface** is first-class too: landing (`/`), `/blog`, `/register`, `alternatif-moka-pos-laundry`, `tenant-site`, `(public-service)`. Invoke brand mode per-task (e.g. `/impeccable craft landing`, `/impeccable critique /`) to load `reference/brand.md`.

Token tell: the app runs indigo (`--color-brand: #4f46e5`, emerald secondary); public pages scope to sky-blue via `.pub-scope` (`--color-brand: #0284c7`) so the marketing site reads as a different, acquisition-tuned identity without forking components. PRODUCT.md defaults to `product` because the app is what users pay for.

## Users

UMKM laundry owners in Indonesia — owner-operated, 1–5 outlets. They are behind the counter, often on a single shared laptop or a borrowed phone, juggling walk-in customers, kiloan pickup/drop-off, WhatsApp confirmations, and QRIS/e-wallet payments. Not enterprise, not chains. The owner is usually also the kasir, the admin, and the one reconciling cash at end of day. Their context is busy, interrupt-driven, and impatient with anything that slows the transaction. Bahasa Indonesia primary; many serve customers in casual Indonesian.

## Product Purpose

hivePOS is a lightweight, browser-native point-of-sale and operations app for laundry UMKM. It exists so an owner can open a browser and run the till — take orders (kiloan + satuan), track pickup/drop-off, print 56/58/80mm thermal receipts, send WhatsApp templates, reconcile payments (cash + Midtrans/QRIS), manage inventory & expenses, read cash-flow / piutang / accumulated-WIP reports, and run a simple public order-tracker + tenant website — without installing an app, buying hardware, or signing a contract. Success = the owner completes the daily loop (take order → print → get paid → reconcile) in minutes, on whatever device is in front of them, trusting the numbers. "Kasir laundry, tinggal buka browser."

## Brand Personality

Casual-professional Bahasa Indonesia. "Anda" for CTAs, casual for marketing lines. Three-word personality: **ringan, jujur, Indonesia banget** — light (not heavy enterprise), honest (transparent per-outlet pricing, dogfooded not hyped), natively Indonesian (kiloan, QRIS, pickup, WhatsApp are defaults, not exotic features). Reference brand: **Shopify** — practical-but-aspirational, "anyone can start," light enough to begin today. Emotional goal in the app: calm confidence at the till ("this just works, fast"). Emotional goal on the landing: trust + "I can start in 2 minutes."

## Anti-references

- **Heavy iPad POS apps (Moka-style)** — beautiful but install/hardware-bound, built for chains, not owner-operators.
- **All-in-one suites (Majoo-style)** — feature-bloated, enterprise-flavored, "platform / solution / ecosystem" energy.
- **Android-hardware bundles (Qasir-style)** — lock-in to a device/printer bundle; we are browser-native and hardware-agnostic.
- **Buzzword SaaS landing pages** — "AI-powered synergy," gradient-text heroes, the hero-metric big-number template, the cream/sand/orange "warm AI" 2026 default.
- **Enterprise posture** — pretending to be a platform/solution/ecosystem when the user is one owner with one outlet.

## Design Principles

1. **Ringan di atas segalanya (Lightness above all).** Every screen should feel instant. Fewer fields, fewer clicks, fewer cards. The owner is mid-transaction; friction costs real money. Prefer one focused screen over a nested-card maze.
2. **Concrete, bukan abstrak.** "2 menit," "Rp 49K/outlet," "1 outlet gratis" — not "cepat," "terjangkau," "modern." Nouns and numbers over adjectives, in copy and UI alike.
3. **Indonesian context is the default path, not a feature.** Kiloan, satuan, pickup, QRIS/e-wallet, WhatsApp templates, 58mm thermal receipts, piutang — these are the happy path. Never treat them as edge cases or localize them away.
4. **Tanpa ribet, tanpa install.** Browser-native and hardware-agnostic is the differentiator. Never propose app installs, hardware bundles, or contracts as "the answer." If a design implies the user must buy something, it's wrong for this brand.
5. **Jujur dan DIY-proofed.** Transparent pricing, honest stats, dogfooding as supporting proof (never the hero). No dark patterns, no inflated metrics, no promising features that don't exist (offline mode, hardware bundles).
6. **Numbers are sacred.** This is a till and a ledger. Money, piutang, WIP, inventory — render with tabular numerics, never lose precision to ad-hoc `.toString()`, never decorate financial data into illegibility.

## Accessibility & Inclusion

Target **WCAG 2.1 AA** (commercial SaaS bar): ≥4.5:1 body-text contrast — and 4.5:1 for placeholder text too, not the muted-gray default; full keyboard navigation with visible focus; screen-reader labels on all controls; `prefers-reduced-motion` fallbacks on every animation (already shipped in `app/globals.css`). Colorblind-safe data viz: the heatmap ships a 45° pattern overlay on high-intensity cells (pattern, not color alone) — extend that discipline to any new chart. Bilingual `en` + `id` is a baseline inclusion requirement, not a nicety: every user-facing string flows through `t("key")` with entries in both locales, no interpolation. Assume low-bandwidth / older-device users (UMKM hardware is often a borrowed phone) — ship light, fast, resilient.
