# hivePOS Keyword Research — laundry UMKM long-tail + pain-point

> Research deliverable: long-tail / customer-pain-point keywords Indonesian laundry owners search.
> Informs blog posts, comparison pages, landing copy. Companion to `GROW-WEBSITE-PLAN.md`.
> Created 2026-07-24.

**Volume caveat:** no GSC/Ahrefs/Keyword Planner access. Signal grades (H/M/L) estimated from SERP density + competitor targeting. Re-rank against real impressions once GA4 + Search Console are wired (awaiting GA4 ID — see `GROW-WEBSITE-PLAN.md`).

**Sources:** SERP/content landscape for "aplikasi kasir laundry", "software laundry kiloan", "alternatif Moka POS laundry", "masalah operasional usaha laundry" (cucian hilang/salah hitung/antrian), "kirim nota laundry via WhatsApp QRIS gratis tanpa install". Refs: mokapos.com/harga, jurnal.id, dicatetin.com, mekari.com, aplikasilaundryandroid.com, smartlink.id, sakulaundry.com, laundrygo.id.

---

## 1. Pain-point clusters

### Cluster A — Cucian hilang / tertukar / rusak (HIGH intent, HIGH emotion)
#1 operational fear. Legal: UUPK Pasal 19 = laundry wajib ganti rugi.
| Long-tail (id) | Intent | Signal |
|---|---|---|
| cucian laundry hilang siapa tanggung jawab | info | M |
| ganti rugi cucian hilang laundry | info | M |
| cara mencegah cucian tertukar di laundry | info/comp | M |
| aplikasi laundry anti tertukar | transactional | M |
| sistem pelacakan cucian laundry | transactional | M |
| tracking cucian laundry real-time | transactional | L |
| label kode order laundry otomatis | transactional | L |
**Maps to:** `/track/[orderNumber]` exists (public tracking) but no marketing "anti-tertukar" page. **Gap → blog + landing section.**

### Cluster B — Salah hitung + pencatatan manual (HIGH volume)
| Long-tail (id) | Intent | Signal |
|---|---|---|
| cara hitung harga laundry kiloan | info | H |
| aplikasi hitung kiloan laundry | transactional | H |
| harga satuan laundry per potong | info | M |
| salah hitung cucian laundry | info | L |
| cara catat transaksi laundry | info | M |
| pencatatan keuangan laundry excel | info | M |
| aplikasi catat pesanan laundry | transactional | H |
**Gap → "cara hitung harga kiloan" how-to blog (high traffic) + calculator.**

### Cluster C — Karyawan curang / pendapatan bocor (HIGH pain, underserved)
| Long-tail (id) | Intent | Signal |
|---|---|---|
| mencegah kecurangan karyawan laundry | info | M |
| aplikasi laundry anti curang | transactional | L |
| pendapatan laundry bocor tanpa terasa | info | M |
| rekap transaksi laundry harian | transactional | M |
| sistem pengawasan karyawan laundry | info | L |
**Gap → blog "tutup celah kecurangan karyawan laundry" (hivePOS logs every transaction).**

### Cluster D — Antrian & status cucian saat ramai (seasonal H)
| Long-tail (id) | Intent | Signal |
|---|---|---|
| status cucian laundry online | transactional | M |
| aplikasi antrian laundry | transactional | L |
| cek status laundry pelanggan | transactional | M |
| cucian menumpuk lebaran | info | M (seasonal) |
| notifikasi cucian selesai otomatis | transactional | M |
**Gap → seasonal blog + "pelanggan cek sendiri" USP.**

### Cluster E — Nota/WhatsApp/QRIS (HIGHEST purchase intent)
Most-converted cluster. Every competitor (Smartlink, DealPOS, Ketoko, Nyuci, Piposmart) targets "kirim nota via WhatsApp".
| Long-tail (id) | Intent | Signal |
|---|---|---|
| kirim nota laundry lewat whatsapp | transactional | H |
| aplikasi laundry kirim struk wa otomatis | transactional | H |
| kasir laundry qris | transactional | H |
| terima pembayaran qris laundry | transactional | M |
| nota digital laundry | transactional | M |
| cetak struk thermal laundry android | transactional | M |
| aplikasi laundry kirim tagihan wa | transactional | M |
**Gap → `/fitur/nota-whatsapp` + `/fitur/qris` pages, or strong blog.**

### Cluster F — Laporan keuangan + multi-outlet (growing-business buyer)
| Long-tail (id) | Intent | Signal |
|---|---|---|
| laporan keuangan laundry otomatis | transactional | H |
| aplikasi laporan pendapatan laundry | transactional | M |
| aplikasi laundry multi cabang | transactional | M |
| kelola laundry lebih dari satu outlet | transactional | L |
| rugi laba laundry bulanan | info/comp | M |
**Gap → `/fitur/laporan` + `/fitur/multi-outlet`.**

### Cluster G — Gratis / tanpa install / pemula (ToFU, price-sensitive)
| Long-tail (id) | Intent | Signal |
|---|---|---|
| aplikasi kasir laundry gratis | transactional | H |
| aplikasi laundry gratis tanpa install | transactional | M |
| aplikasi laundry berbasis web | transactional | M |
| kasir laundry di browser | transactional | L |
| aplikasi laundry untuk pemula | info/comp | M |
| mulai usaha laundry modal kecil | info | M |
| aplikasi laundry online gratis | transactional | H |
**Maps to:** hero ("tanpa install", "1 outlet gratis"). Push harder + dedicated angle page.

---

## 2. Competitor-alternative (comparison intent)

**Live (7)** `lib/alternatif-data.ts`: Moka, Olsera, Majoo, Kasir Pintar, Pawoon, iSeller, Qasir.
Moka anchor: Rp299K–499K/outlet/mo vs hivePOS Rp49K+ / 1 outlet free → "hemat 70%" wedge.

**Gaps (real demand, NOT yet targeted):**
| New slug | Signal |
|---|---|
| alternatif-bantucatat-laundry | M |
| alternatif-dicatetin-laundry | M |
| alternatif-saku-laundry | M |
| alternatif-laundrygo-laundry | L |
| alternatif-piposmart-laundry | L |
| alternatif-smartlink-laundry | L |
| alternatif-klinify-laundry | L |

Broader non-branded: "aplikasi kasir laundry selain moka pos", "moka pos vs hivepos", "aplikasi laundry termurah di indonesia".

---

## 3. Business-guide / how-to (ToFU blog → authority + internal links)

| Long-tail (id) | Intent | Signal |
|---|---|---|
| cara memulai usaha laundry kiloan | info | H |
| modal usaha laundry 2025 | info | H |
| standar harga kiloan laundry 2025 | info | H |
| keuntungan usaha laundry kiloan | info | H |
| SOP laundry kiloan | info | M |
| cara pasang harga laundry | info | M |
| tips sukses usaha laundry rumahan | info | M |

Blog system ready (`/api/public/blog-posts`, `/blog/[slug]` w/ Article JSON-LD).

---

## Priority

**Tier 1 (product-aligned + high intent, fastest to rank):**
- E: nota-WhatsApp + QRIS feature/blog pages.
- B: "cara hitung harga kiloan" how-to blog + calculator hook.
- G: strengthen "gratis / tanpa install" copy + angle page.
- A: "anti tertukar" / tracking marketing blog.

**Tier 2 (clone proven model):** new alternatif pages — BantuCatat, Dicatetin, Saku Laundry first, then Piposmart/Smartlink/LaundryGO/Klinify. One entry each in `lib/alternatif-data.ts` + page.

**Tier 3 (ToFU, compounds):** cara mulai usaha laundry, modal, standar harga kiloan 2025, SOP.

**Tier 4 (niche/defensive):** C (karyawan curang), D (antrian/seasonal), multi-outlet feature pages.

---

## Apply
- Content only: blog posts via `/api/public/blog-posts`, comparison pages via `lib/alternatif-data.ts`, feature-page copy.
- Every new page: title + 150-160 desc, canonical, JSON-LD, internal link from landing (pattern from SEO-hardening commit `37129da`).
- Post GA4+GSC: re-rank clusters with real impression data.

## Out of scope
- Exact volume numbers (needs Keyword Planner/Ahrefs/GSC).
- Writing the actual posts/pages (separate task once keywords approved).
- Paid/marketplace keyword strategy (Shopee/Tokopedia/Google Ads).
