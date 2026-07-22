# hivePOS SEO Keyword Research

**Date:** 2026-07-22 · **Market:** Indonesia (Bahasa Indonesia) · **Domain:** hivepos.id
**Goal:** Map keywords already targeted vs gaps, prioritize the next content, and give
the team a 90-day plan. Derived from the existing marketing copy, blog inventory,
and competitor SERP analysis.

> Volume/difficulty are **signals** (High/Med/Low), not exact tool numbers — confirm in
> Google Search Console + Keyword Planner before committing to a cluster. Intent stage:
> **ToFu** (awareness), **MoFu** (comparison), **BoFu** (ready to buy).

---

## 1. Current state — already targeted

These are covered by existing content (homepage, `/alternatif-moka-pos-laundry`,
5+1 blog posts). **Don't duplicate** — defend and internal-link to them.

| Keyword cluster | Stage | Landing page | Status |
|---|---|---|---|
| `kasir laundry` / `aplikasi kasir laundry` | MoFu/BoFu | `/`, `/blog` | ✅ Core |
| `software laundry` / `software kasir laundry` | MoFu | `/`, blog | ✅ |
| `harga software kasir laundry` / `harga aplikasi kasir laundry` | BoFu | blog (`harga-software…`) | ✅ |
| `laundry kiloan` / `sistem kasir kiloan` | ToFu/MoFu | blog (`sistem-kasir-kiloan…`) | ✅ |
| `alternatif moka pos laundry` / `hivepos vs moka pos` | BoFu | `/alternatif-moka-pos-laundry`, blog | ✅ Strong (priority 0.9) |
| `fitur aplikasi kasir laundry` | MoFu | blog (`fitur-wajib…`) | ✅ |

**Strength:** hivePOS owns one strong comparison page (vs Moka) and covers pricing/fitur/kiloan.
**Weakness:** only *one* competitor page; brand absent from "aplikasi kasir laundry terbaik"
listicles; no top-of-funnel startup guides until the new article.

---

## 2. Prioritized gap clusters

Ranked by **estimated ROI** (volume × conversion intent ÷ difficulty). Each is a candidate
for a new page or article.

| # | Keyword / cluster | Stage | Vol | Diff | Why it wins | Action |
|---|---|---|---|---|---|---|
| 1 | `alternatif olsera laundry` / `hivepos vs olsera` | BoFu | Med | Low | Olsera is the direct laundry-POS competitor (owns `/id/pos/laundry`); comparison pages convert + are winnable | **#1 NEXT: build `/alternatif-olsera-laundry`** (mirror Moka page) |
| 2 | `aplikasi kasir laundry terbaik 2026` | MoFu | High | High | Big listicles (Kasir Pintar, Inticore, Jurnal) rank here — high traffic if cracked | Hard to outrank; instead write a differentiated **"untuk laundry kecil"** angle blog |
| 3 | `cara memulai usaha laundry kiloan` / `modal usaha laundry` | ToFu | High | Med | High-volume research intent; builds domain authority; feeds conversion pages | **✅ DONE** — `cara-memulai-usaha-laundry-kiloan` |
| 4 | `alternatif majoo` / `aplikasi pos majoo vs` | BoFu | Med | Low | Majoo is all-in-one (expensive, bloaty) — fits the anti-bloat positioning | Build `/alternatif-majoo` next |
| 5 | `aplikasi laundry gratis` / `kasir laundry gratis` | BoFu | Med | Med | hivePOS has a genuine free tier (1 outlet) — strong honest hook | Blog: "aplikasi kasir laundry gratis terbaik" |
| 6 | `self service laundry` / `laundry coin` | MoFu/ToFu | Med (rising) | Low | Emerging segment, little laundry-specific POS content | Blog + future feature page |
| 7 | `software laundry multi outlet` / `kasir laundry cabang` | BoFu | Low | Low | Matches the paid tier exactly; high-intent buyer | Feature page under existing multi-outlet copy |
| 8 | `aplikasi laundry whatsapp order` | MoFu | Med | Low | Built-in WhatsApp is a real differentiator most POS lack | Blog: "terima order laundry via WhatsApp otomatis" |
| 9 | `harga cuci kiloan` / `tarif laundry per kg` | ToFu | High | Med | Local search intent; captures future owners pre-buy | Section in startup guide (done) → could be its own page |
| 10 | `printer thermal laundry` / `timbangan digital laundry` | ToFu | Low | Low | Equipment queries; cross-sell setup content | Long-tail blog series (low priority) |

---

## 3. Headline recommendations

1. **#1 next content = `/alternatif-olsera-laundry`** (competitor comparison page).
   - Olsera is the closest direct competitor with a dedicated laundry page. hivePOS already
     proved the format works (Moka page = sitemap priority 0.9). Bottom-funnel → highest
     signup conversion per visit. Then repeat the pattern for **Majoo** and **iSeller/Pawoon**.
   - Pattern to copy: `app/alternatif-moka-pos-laundry/page.tsx` (title, canonical, OG, FAQ JSON-LD,
     comparison table). Add to `app/sitemap.ts` at priority 0.9.

2. **Defend "aplikasi kasir laundry" with a differentiation angle.** The generic "terbaik"
   listicles are dominated by big brands (Kasir Pintar, Mekari, Jurnal) — don't fight head-on.
   Win the long tail: "aplikasi kasir laundry **untuk UMKM / kiloan / dari HP**" where the
   browser-native + laundry-specific angle is the differentiator.

3. **The startup guide (done) should be the ToFu hub.** Internal-link it from the homepage
   "Artikel Terbaru" + from every other blog post. Capture researchers *before* they're in
   the market for a POS, then nurture to `/register`.

4. **Lean into the honest free tier.** "Gratis 1 outlet selamanya" is rare and true — make
   `aplikasi laundry gratis` a owned term. Most competitors only offer trials.

---

## 4. Suggested 90-day content plan

| Month | Output | Target cluster |
|---|---|---|
| M1 (done) | Fix blog pipeline + metadata defaults + startup-guide article | Unblock all blog SEO |
| M1 | `/alternatif-olsera-laundry` comparison page | #1 BoFu gap |
| M2 | `/alternatif-majoo` + "aplikasi kasir laundry gratis" blog | BoFu + free-tier |
| M2 | "Terima order laundry via WhatsApp otomatis" blog | Differentiator |
| M3 | `/alternatif-iseller-laundry` (or Pawoon) + self-service-laundry blog | BoFu + rising niche |
| Ongoing | Submit to "aplikasi kasir laundry terbaik" listicles (outreach) | Awareness / backlinks |

---

## 5. Quick wins already shipped in this pass

- **Blog read pipeline unblocked** — `GET /api/public/blog-posts` + `/{slug}` in `public_api`
  (the 5 existing posts were not rendering live; now they do). Biggest single SEO fix.
- **Root metadata** — added `metadataBase` (resolves OG image URLs), default `openGraph`
  (siteName, locale `id_ID`), default `twitter` card. Inherits to every page.
- **Landing metadata** — added `openGraph` + `twitter` to `/`.
- **New ToFu article** — `cara-memulai-usaha-laundry-kiloan` (modal, harga/kg, SOP, BEP,
  internal links to existing posts + `/register`).

> Note: `titleTemplate` was intentionally **not** added — existing marketing titles already
> hand-append `| hivePOS`; a global template would double-suffix them. Revisit if titles are
> ever standardized to bare strings.

---

## 6. Open items / next iterations

- Centralize the hardcoded `https://hivepos.id` → `NEXT_PUBLIC_SITE_URL` (6 files: sitemap,
  robots, tenant-site, track layout, metadataBase, page OG urls).
- `/api/public/tenants` Go endpoint (sitemap tenant URLs) — separate from blog.
- Add Google Search Console verification + submit `sitemap.xml`; track which keywords actually
  land to refine volume signals above with real data.
- Build a `/blog/tag` or category grouping once post count grows (kiloan, perbandingan, tips).
