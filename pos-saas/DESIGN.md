---
name: hivePOS
description: Kasir laundry ringan di browser — indigo till for the app, sky-blue for the door.
colors:
  counter-indigo: "#4f46e5"
  counter-indigo-600: "#4f46e5"
  counter-indigo-700: "#4338ca"
  counter-indigo-500: "#6366f1"
  paid-emerald: "#10b981"
  buka-browser-sky: "#0284c7"
  buka-browser-sky-700: "#0369a1"
  counter-white: "#fafafa"
  surface: "#ffffff"
  ink: "#0a0a0f"
  muted-slate: "#71717a"
  hairline: "#e4e4e7"
  muted-fill: "#f1f1f4"
  destructive: "#ef4444"
  success: "#22c55e"
  warning: "#f59e0b"
  whatsapp-green: "#25d366"
typography:
  display:
    fontFamily: "Manrope, var(--font-inter), ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  storefront-display:
    fontFamily: "Plus Jakarta Sans, var(--font-inter), ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 6vw, 4rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0"
rounded:
  sm: "4px"
  card: "8px"
  default: "12px"
  pill: "9999px"
spacing:
  control-y: "6px"
  control-x: "12px"
  page-pad: "24px"
  section-gap: "32px"
components:
  button-primary:
    backgroundColor: "{colors.counter-indigo}"
    textColor: "{colors.counter-white}"
    typography: "{typography.label}"
    rounded: "{rounded.default}"
    padding: "8px 14px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "{colors.counter-indigo-700}"
  button-primary-active:
    backgroundColor: "{colors.counter-indigo-700}"
  button-touch:
    backgroundColor: "{colors.counter-indigo}"
    textColor: "{colors.counter-white}"
    rounded: "{rounded.default}"
    height: "44px"
    padding: "12px 20px"
  button-outline:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "8px 14px"
    height: "32px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "8px 14px"
    height: "32px"
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "{colors.counter-white}"
    rounded: "{rounded.default}"
    padding: "8px 14px"
    height: "32px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "4px 10px"
    height: "32px"
  badge:
    backgroundColor: "{colors.counter-indigo}"
    textColor: "{colors.counter-white}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 8px"
    height: "20px"
  metric-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.default}"
    padding: "20px"
---

# Design System: hivePOS

## 1. Overview

**Creative North Star: "The Clean Counter"**

Picture a real Indonesian laundry counter at 9am: wiped down, the till open, a kiloan tag in one hand, the next customer walking in. Nothing stacked, nothing installed, nothing to boot up — the register is just *there*, ready. That feeling is the whole system. hivePOS is the browser tab that behaves like that counter: light, honest, natively Indonesian, and ready the instant it's opened.

The system runs on **two committed hues across two surfaces, never mixed on one screen**. The product app (dashboard, kasir, super-admin, order tracking) speaks **Counter Indigo** — confident, operational, the color of the till. The public door (landing, blog, register, comparison, tenant-site) speaks **Buka-Browser Sky** — open, acquisitive, the color of "tinggal buka browser." The mechanism is a single scoped override (`.pub-scope`) that remaps the brand token, so the same components serve both identities without forking. This is the center of gravity for every visual decision.

Density is **operator-grade, not marketing-air**: 32px-tall controls, 8px radii on cards, 12px on containers, tabular-aligned money, and a disciplined neutrals ramp (`#fafafa` counter on `#0a0a0f` ink). Restraint is the default — flat surfaces, hairline `ring-1 ring-foreground/10` borders, no decorative shadows. Motion is purposeful and always carries a `prefers-reduced-motion` off-switch.

**What this system explicitly rejects** (from `PRODUCT.md`): heavy iPad-POS aesthetics (Moka-style), all-in-one suite bloat (Majoo-style), hardware-bundle lock-in (Qasir-style), and the 2026 "warm AI" landing default — no cream/sand/beige body backgrounds, no gradient text, no glassmorphism-as-decoration, no hero-metric big-number template as a reflex, no side-stripe accent borders. Indonesian context (kiloan, QRIS, WhatsApp, 58mm thermal receipts) is the happy path, not a localization afterthought.

**Key Characteristics:**
- Two committed hues, two surfaces, never mixed (indigo in-app, sky on `.pub-scope`).
- Operator-grade density: 32px controls, tabular money, hairline borders.
- Flat by default; no decorative shadows.
- Motion with a mandatory reduced-motion off-switch.
- Hex is canonical for the core palette (iOS Safari < 15.4 safety); OKLCH reserved for the data-viz heat ramp.

## 2. Colors

A restrained palette: one indigo carries the app, one sky carries the door, emerald marks "paid," and a cool neutral ramp holds everything else. Color is information first, decoration never.

### Primary
- **Counter Indigo** (`#4f46e5`, with `#4338ca` hover / `#6366f1` ring): the till. Primary CTAs, active nav, focus rings, links, and the dashboard brand mark. Used on ≤10% of any app screen — its rarity is the point. Under `.pub-scope` this token is remapped to Buka-Browser Sky so the same CTA components re-skin without edits.

### Secondary
- **Paid Emerald** (`#10b981`): success and money-received. Payment-confirmed states, positive deltas, the "sudah bayar" badge. Never a CTA color.
- **Buka-Browser Sky** (`#0284c7`, `#0369a1` deep): the public door. The committed accent for landing/register/comparison/tenant-site via `.pub-scope`. Replaces indigo + emerald + amber on public surfaces only.

### Tertiary (status, scoped)
- **Destructive** (`#ef4444`): delete, void, overdue.
- **Warning** (`#f59e0b`) / **Success** (`#22c55e`): semantic flags in tables and badges.
- **WhatsApp Green** (`#25d366`): reserved exclusively for the floating WhatsApp FAB and in-app WhatsApp actions — brand-accurate, never reused as a generic accent.

### Neutral
- **Counter White** (`#fafafa`): body background — a true near-white, *not* a warm cream. The single biggest reason AI POS designs feel off is a sand/beige body; this is the deliberate counter-move.
- **Surface** (`#ffffff`): cards, popovers, inputs.
- **Ink** (`#0a0a0f`): primary text.
- **Muted-Slate** (`#71717a`): secondary text — **use with care** (see rule below); on `#fafafa` it sits at ~4.6:1, borderline WCAG AA for body. Reserve for genuinely secondary metadata, never body copy or placeholder text.
- **Hairline** (`#e4e4e7`): borders, dividers, input strokes.
- **Muted-Fill** (`#f1f1f4`): subtle fills — table footer, tab track, hover wash.

### Named Rules
**The Two-Hue Rule.** One surface, one hue. Indigo inside the app; sky on `.pub-scope`. Never put an indigo CTA on a public page or a sky CTA inside the dashboard. The `.pub-scope` override exists so this is enforced at the token layer, not by hand.

**The Money-Is-Tabular Rule.** Every currency figure renders with `font-variant-numeric: tabular-nums` (the `.sa-tnum` helper). Prices, totals, piutang, WIP — no exceptions, no ad-hoc `.toString()`. Money that wobbles is money that looks wrong.

**The Muted-Slate Rule.** `#71717a` is for metadata only (timestamps, secondary labels). If text carries information the user reads as a sentence, step it up to Ink. When in doubt, darken toward `#52525b`.

## 3. Typography

**Display Font:** Manrope (with Inter fallback) — platform display, 700/800 only.
**Storefront Display Font:** Plus Jakarta Sans (with Inter fallback) — public-site and tenant-site heroes.
**Body Font:** Inter (with `ui-sans-serif, system-ui` fallback).
**Label/Mono Font:** Inter at 500 weight for labels; no dedicated mono face (use tabular-nums, not a mono font).

**Character:** A geometric-humanist pairing. Manrope's geometric confidence at display sizes signals "this is a real tool"; Inter's humanist clarity at body sizes keeps dense operator screens legible at 14px for hours. Jakarta enters only at the public door to give marketing a slightly warmer, more retail display voice without breaking the family. Three voices, one clan — contrast is by weight and role, not by pitting two similar sans-serifs against each other.

### Hierarchy
- **Display** (Manrope 800, `clamp(2rem, 5vw, 3.5rem)`, 1.05, `-0.02em`): dashboard section openers, super-admin page titles. Use sparingly.
- **Storefront Display** (Jakarta 800, `clamp(2.25rem, 6vw, 4rem)`, 1.05): landing/tenant-site heroes only. `text-wrap: balance`.
- **Title** (Inter 600, 18px, 1.3): card titles, page headers, section labels.
- **Body** (Inter 400, 14px, 1.5): all operational copy. Cap line length at 65–75ch in marketing prose; dashboards run wider for density.
- **Label** (Inter 500, 13px, 1.4): buttons, badges, table headers, form labels. Never uppercase-tracked eyebrows as default scaffolding (see Don'ts).

### Named Rules
**The No-Eyebrow Rule.** Small uppercase tracked kickers ("ABOUT", "PROSES", "HARGA") above every section are forbidden — that's the 2023-era AI scaffold. One named kicker as a deliberate brand element is voice; an eyebrow per section is noise. Reach for numbered markers only where a real ordered sequence exists (the 3-step "how it works" earns them; a feature grid does not).

**The 65ch Rule.** Marketing and long-form prose caps at 65–75 characters. Operator tables and forms are exempt — density is the job there.

## 4. Elevation

This system is **flat by default**. Depth is conveyed by tonal layering (`#ffffff` surface on `#fafafa` body, `ring-1 ring-foreground/10` hairline) and by motion (tiles that lift in on load), not by ambient shadow. Shadows appear only as a deliberate response to state or as a named accent — never as decoration.

### Shadow Vocabulary
- **Hairline ring** (`ring-1 ring-foreground/10`, ≈ 10% ink ring): the default container boundary — cards, popovers, dialogs, inputs' focus ring base. This is the workhorse; reach for it 90% of the time.
- **Popover/dialog lift** (`shadow-xl` + `ring-1 ring-foreground/10`): momentary elevation for floating layers — menus, dialogs, sheets. Removed on close.
- **WhatsApp FAB glow** (`shadow-xl shadow-[#25d366]/30` + `animate-soft-pulse`): the one ambient shadow in the system, reserved for the persistent FAB.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow appears only when something is genuinely floating (dialog, popover, FAB). If a card has a resting ambient shadow, it's wrong — use a hairline ring instead.

**The No-Glass Rule.** Frosted-glass cards (`backdrop-filter: blur()` as a decoration) are forbidden except the one named landing nav/hero surface, and even there only in light mode. Glassmorphism is not a default — it is a rare, purposeful exception.

## 5. Components

### Buttons
- **Shape:** gently rounded (`rounded-lg`, 8px) — not pill, not square.
- **Primary:** Counter Indigo fill, white text, 32px tall (default), 14px label weight 500. `touch` size steps to 44px for mobile primary actions. Active state nudges `translate-y-px`; hover deepens to `#4338ca`. Re-skins to Buka-Browser Sky under `.pub-scope`.
- **Hover / Focus:** `ring-3 ring-ring/50 focus-visible` for keyboard focus (always visible, never removed); hover darkens the fill, never adds shadow.
- **Outline / Ghost:** outline = white fill + hairline border; ghost = transparent. Both inherit Ink text. Used for secondary actions ("Batal", "Lihat Demo").
- **Destructive:** solid `#ef4444` for confirm-delete; `bg-destructive/10 text-destructive` for the softer destructive badge.
- **Icon buttons:** square, 32px (or 44px `touch`), always carry `aria-label`. Never decorative-only icons in the operational path.

### Badges / Chips
- **Style:** pill (`rounded-full`), 20px tall, 13px label. Default = indigo fill; but most operational badges use tinted fills (`bg-emerald-100/80 text-emerald-700` for paid, amber for pending, red for overdue) **with text labels, never color alone**.
- **State:** status badges dual-code (color + word) for colorblind safety — see the heatmap pattern as the model.

### Cards / Containers
- **Corner:** 8px (`rounded-lg`) for cards, 12px (`rounded-xl`) for large containers/dialogs.
- **Background:** Surface `#ffffff` on the Counter White body. Footer band uses `bg-muted/50`.
- **Border:** hairline `ring-1 ring-foreground/10`, not a solid stroke.
- **Shadow:** none at rest (Flat-By-Default).
- **Padding:** 16px default (`p-4`); 20px (`p-5`) for MetricTiles. **Nested cards are always wrong** — if you reach for a card inside a card, restructure.

### Inputs / Fields
- **Style:** 32px tall, hairline border, 8px radius, `text-base` to prevent iOS zoom.
- **Focus:** border shifts to ring color + `ring-3 ring-ring/50` — always visible.
- **Required:** mark with both a visual asterisk *and* `aria-required` (current gap — see audit).
- **Touch:** `data-size="touch"` steps to 44px height for mobile forms.

### Navigation (sidebar)
- **Style:** 4 grouped buckets (shared, active-module, admin, help) behind `icon + label`. Active item = `bg-sidebar-accent/80 font-semibold` + a 3px left accent bar + icon hue shift. Never icon-only in the operational nav.
- **Gating:** every item requires `hasFlag(item.flag) && can(item.resource, item.action)` — both must hold or it hides.
- **ALL-outlets mode:** `branchId === "ALL"` collapses the sidebar to dashboard + reporting + printer settings.

### Signature: MetricTile
The dashboard/super-admin stat tile. 20px padding, tinted icon circle (tone = default/primary/success/warning/danger), large **tabular-nums** value, uppercase label, optional sparkline, optional href. Enters with `animate-tile-in` (8px lift + 0.985 scale, `ease-out-quint`, 40ms stagger). The tabular value is non-negotiable — a wobbling KPI number reads as a broken till.

### Signature: Heatmap
The "Jam Ramai" (busy-hours) contribution heatmap — the system's model for colorblind-safe data viz. A 6-step OKLCH intensity ramp (`--heat-0…5`, hue drifting 75→55 as intensity rises) with a **45° pattern overlay on the top two levels** so peak cells are distinguishable without color. Every new chart should inherit this pattern-or-texture discipline.

### Signature: WhatsApp FAB
The super-admin panel uses the standard flat Counter-Indigo system — the same hairline-ring cards, solid primary fills, and `shadow-sm` surfaces as the tenant app (parity, not a separate back-office skin). The WhatsApp FAB (`#25d366`, 56px circle, bottom-right, `animate-soft-pulse`) is the single persistent floating element across public surfaces.

## 6. Do's and Don'ts

### Do:
- **Do** keep one hue per surface: Counter Indigo in the app, Buka-Browser Sky on `.pub-scope`. Let the token override do the work.
- **Do** render every currency figure with `tabular-nums` (`.sa-tnum`). Money is sacred — it must not wobble.
- **Do** dual-code status (color + text label + pattern where high-stakes), modeled on the heatmap.
- **Do** keep a visible `focus-visible` ring (`ring-3 ring-ring/50`) on every interactive element — keyboard users live here.
- **Do** use concrete Indonesian copy: "Rp 49K/outlet", "2 menit", "1 outlet gratis" — nouns and numbers, not adjectives.
- **Do** ship `prefers-reduced-motion` fallbacks on every animation (the system already does; preserve it).

### Don't:
- **Don't** use border-left/border-right > 1px as a colored accent stripe on cards, list items, or alerts. Side-stripes are forbidden.
- **Don't** use gradient text (`background-clip: text` + gradient). Single solid color; emphasize with weight or size.
- **Don't** reach for glassmorphism / `backdrop-filter` as a default surface treatment — it's a rare, named exception (landing nav/hero, light mode only).
- **Don't** reproduce the hero-metric template (big number + small label + supporting stats + gradient) as a reflex — the dashboard's grouped KPIs are deliberate, not a template to stamp everywhere.
- **Don't** put an uppercase-tracked eyebrow kicker above every section, or numbered `01/02/03` markers where there's no real sequence.
- **Don't** use a cream/sand/beige body background. Counter White (`#fafafa`) is a true near-white on purpose; warmth comes from accent + imagery, not the body.
- **Don't** use `Muted-Slate #71717a` for body text or placeholders — it's borderline AA (~4.6:1). Step readable sentences up to Ink.
- **Don't** nest cards inside cards. Restructure instead.
- **Don't** pretend to be enterprise — no "platform / solution / ecosystem" posture, no buzzwords ("AI-powered synergy", "revolusioner", "game-changer"). This is one owner, one outlet, one browser tab. (Carried verbatim from `PRODUCT.md` anti-references.)
- **Don't** name competitors (Moka, Majoo, Qasir) in product UI — frame as "tanpa install / tanpa ribet / tanpa kontrak mahal".
