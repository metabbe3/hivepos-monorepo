import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import { PiggyBank, MonitorSmartphone, Shirt, Globe2, Layers, MessageCircle, Zap } from "lucide-react";

// Single source of truth for the /alternatif-*-laundry comparison pages.
// Add a record here + a thin page wrapper → new competitor page + sitemap entry.

export interface ComparisonRow {
  feature: string;
  hivepos: string;
  them: string;
  themNeg?: boolean; // true → mark competitor's value as a disadvantage (X icon)
}
export interface Reason {
  icon: LucideIcon;
  title: string;
  body: string;
}
export interface Faq {
  q: string;
  a: string;
}

export interface Competitor {
  slug: string; // path segment, e.g. "alternatif-olsera-laundry"
  name: string; // "Olsera"
  metaTitle: string;
  metaDescription: string;
  heroH1: string;
  heroHighlight: string; // brand-colored span inside the H1
  dek: string;
  theirPriceFrom: string;
  theirPriceUnit: string;
  theirCardPoints: string[]; // 3 limit points on the competitor pricing card
  comparison: ComparisonRow[];
  reasons: Reason[];
  faqs: Faq[];
  keywords: string[];
}

const SITE = "https://hivepos.id";

const moka: Competitor = {
  slug: "alternatif-moka-pos-laundry",
  name: "Moka POS",
  metaTitle: "Alternatif Moka POS Laundry Termurah | hivePOS Rp 49K/outlet",
  metaDescription:
    "Alternatif Moka POS untuk usaha laundry. hivePOS 3,4× lebih murah (Rp 49K vs Rp 169K), browser-native tanpa iPad, khusus laundry kiloan + WhatsApp order. Gratis 1 outlet selamanya.",
  heroH1: "Alternatif Moka POS untuk Laundry —",
  heroHighlight: "3,4× Lebih Murah",
  dek: "hivePOS adalah kasir laundry yang jalan langsung di browser — tanpa iPad, tanpa hardware mahal. Khusus laundry kiloan dengan WhatsApp order, cetak struk thermal, dan pickup gratis. Mulai Rp 49K/outlet (outlet pertama gratis selamanya).",
  theirPriceFrom: "~Rp 169K",
  theirPriceUnit: "/bln",
  theirCardPoints: ["Semua outlet berbayar", "Butuh iPad / tablet", "POS retail umum, add-on WhatsApp"],
  comparison: [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", them: "~Rp 169K/bulan", themNeg: true },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", them: "Berbayar", themNeg: true },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", them: "iPad app + web" },
    { feature: "Butuh hardware?", hivepos: "Tidak", them: "iPad/tablet", themNeg: true },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", them: "Umum (all retail)" },
    { feature: "WhatsApp order", hivepos: "Built-in + template", them: "Add-on / integrasi", themNeg: true },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", them: "BT/WiFi (butuh iPad)" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", them: "Ya" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", them: "Tidak", themNeg: true },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", them: "Tidak", themNeg: true },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", them: "Tidak", themNeg: true },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", them: "Tidak", themNeg: true },
  ],
  reasons: [
    { icon: PiggyBank, title: "Hemat 70% per bulan", body: "Moka POS ~Rp 169K/bulan. hivePOS Growth Rp 49K/outlet/bulan. Untuk 1 outlet, hemat ~Rp 120K/bulan = Rp 1,44 juta/tahun. Outlet pertama gratis selamanya." },
    { icon: MonitorSmartphone, title: "Tidak butuh iPad", body: "Moka POS butuh iPad (Rp 5–7 juta). hivePOS jalan di HP Android, iPhone, tablet, atau laptop apa saja yang punya browser. Nol investasi hardware." },
    { icon: Shirt, title: "Khusus laundry, bukan retail umum", body: "Moka POS adalah POS retail umum. hivePOS dirancang khusus untuk laundry: kiloan, satuan, garment breakdown (baju, celana, kaos kaki), WhatsApp order otomatis, pickup, dan status tracking." },
    { icon: Globe2, title: "Website laundry gratis (Pro)", body: "Dapatkan website laundry sendiri di slug.hivepos.id dengan SEO lokal Google Maps, tombol WhatsApp order, dan tracking pesanan online. Moka POS tidak punya ini." },
  ],
  faqs: [
    { q: "Apakah hivePOS bisa menggantikan Moka POS sepenuhnya?", a: "Ya. hivePOS punya semua yang Moka POS tawarkan untuk laundry (kasir, struk, laporan, multi-outlet) PLUS fitur khusus laundry yang Moka tidak punya: kiloan pricing, WhatsApp order, pickup, garment breakdown, dan website laundry." },
    { q: "Susah tidak pindah dari Moka ke hivePOS?", a: "Tidak. Kalau Moka Anda bisa export data (pelanggan, layanan, harga), kami bantu import. Kalau tidak, setup layanan + harga di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama." },
    { q: "Apakah printer thermal saya bisa dipakai di hivePOS?", a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di iPhone/iPad, gunakan WiFi atau Browser Print. Di Android/PC dengan Chrome/Edge, semua metode didukung." },
  ],
  keywords: ["alternatif moka pos laundry", "hivepos vs moka pos", "aplikasi kasir laundry pengganti moka pos", "harga moka pos vs hivepos"],
};

const olsera: Competitor = {
  slug: "alternatif-olsera-laundry",
  name: "Olsera",
  metaTitle: "Alternatif Olsera untuk Laundry Termurah | hivePOS Rp 49K/outlet",
  metaDescription:
    "Alternatif Olsera untuk usaha laundry. hivePOS khusus laundry kiloan dengan WhatsApp order, pickup, dan garment breakdown built-in — browser-native, tanpa paket tahunan wajib. Outlet pertama gratis, mulai Rp 49K/outlet.",
  heroH1: "Alternatif Olsera untuk Laundry —",
  heroHighlight: "Lebih Fokus & Hemat",
  dek: "Olsera punya modul laundry, tetapi pada dasarnya POS serbaguna. hivePOS dirancang khusus untuk laundry kiloan — WhatsApp order, pickup, dan garment breakdown sudah built-in. Browser-native, outlet pertama gratis, mulai Rp 49K/outlet tanpa paket tahunan wajib.",
  theirPriceFrom: "~Rp 107K",
  theirPriceUnit: "/bln (tahunan)",
  theirCardPoints: ["Paket tahunan, kurang fleksibel", "POS serbaguna, bukan khusus laundry", "WhatsApp & pickup butuh add-on"],
  comparison: [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", them: "~Rp 107K/bln (tahunan)", themNeg: true },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", them: "Berbayar", themNeg: true },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", them: "Browser + app" },
    { feature: "Butuh hardware?", hivepos: "Tidak", them: "Opsional" },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", them: "Modul laundry (umum)" },
    { feature: "WhatsApp order", hivepos: "Built-in + template", them: "Add-on / integrasi", themNeg: true },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", them: "BT/USB/WiFi" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", them: "Ya (berbayar)" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", them: "Tidak", themNeg: true },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", them: "Tidak", themNeg: true },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", them: "Tidak", themNeg: true },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", them: "Tidak", themNeg: true },
  ],
  reasons: [
    { icon: PiggyBank, title: "Lebih murah + langganan fleksibel", body: "Olsera ditawarkan per paket tahunan (~Rp 107K–224K/bln). hivePOS Rp 49K/outlet/bulan tanpa terkunci tahunan, dan outlet pertama gratis selamanya." },
    { icon: Shirt, title: "Lebih fokus ke laundry", body: "Olsera adalah POS serbaguna untuk retail/F&B. hivePOS khusus laundry: harga kiloan & satuan otomatis, garment breakdown, WhatsApp order, dan pickup — semua built-in." },
    { icon: Zap, title: "Tanpa ribet hardware", body: "Olsera mendorong app + paket hardware. hivePOS cukup buka browser di HP, tablet, atau laptop yang sudah Anda miliki. Nol investasi alat baru." },
    { icon: Globe2, title: "Website laundry (Pro)", body: "Dapatkan website laundry di slug.hivepos.id dengan SEO lokal Google Maps, tombol WhatsApp order, dan tracking pesanan. Olsera tidak menyediakan ini." },
  ],
  faqs: [
    { q: "Apakah hivePOS bisa menggantikan Olsera untuk laundry?", a: "Ya. hivePOS punya semua yang Olsera tawarkan untuk laundry (kasir, struk, laporan, multi-outlet) PLUS kiloan pricing, WhatsApp order built-in, pickup, garment breakdown, dan website laundry. Tanpa paket tahunan wajib." },
    { q: "Bisa pindah dari Olsera ke hivePOS?", a: "Bisa. Setup layanan + harga di hivePOS cuma butuh 2 menit. Data pelanggan bisa diketik saat order pertama atau diimpor dari export Olsera Anda." },
    { q: "Printer thermal saya bisa dipakai di hivePOS?", a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di Android/PC semua metode didukung; di iPhone/iPad gunakan WiFi atau Browser Print." },
  ],
  keywords: ["alternatif olsera laundry", "olsera vs hivepos", "aplikasi kasir laundry pengganti olsera", "harga olsera vs hivepos"],
};

const majoo: Competitor = {
  slug: "alternatif-majoo-laundry",
  name: "Majoo",
  metaTitle: "Alternatif Majoo POS untuk Laundry — Lebih Murah | hivePOS",
  metaDescription:
    "Alternatif Majoo untuk usaha laundry. Majoo suite all-in-one mahal & berat untuk laundry kecil. hivePOS fokus khusus laundry kiloan — WhatsApp order, pickup, garment breakdown. Mulai Rp 49K/outlet, outlet pertama gratis.",
  heroH1: "Alternatif Majoo POS untuk Laundry —",
  heroHighlight: "Tanpa Mahal & Ribet",
  dek: "Majoo adalah suite all-in-one yang lengkap, tapi mahal (Rp 249K–999K/bln) dan berlebihan untuk laundry kecil. hivePOS fokus khusus laundry kiloan — WhatsApp order, pickup, dan garment breakdown — separuh harganya. Outlet pertama gratis, mulai Rp 49K/outlet.",
  theirPriceFrom: "Rp 249K",
  theirPriceUnit: "/bln (Starter)",
  theirCardPoints: ["Mulai Rp 249K/bln, hingga 999K", "Suite berat, overkill untuk laundry kecil", "Sering bundle hardware POS"],
  comparison: [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", them: "Rp 249K/bln (Starter)", themNeg: true },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", them: "Berbayar", themNeg: true },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", them: "App + bundle hardware" },
    { feature: "Butuh hardware?", hivepos: "Tidak", them: "Sering bundle tablet/POS", themNeg: true },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", them: "All-in-one suite (umum)" },
    { feature: "WhatsApp order", hivepos: "Built-in + template", them: "Add-on", themNeg: true },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", them: "Ya (bundle)" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", them: "Ya (mahal)" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", them: "Tidak / terbatas", themNeg: true },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", them: "Tidak", themNeg: true },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", them: "Tidak", themNeg: true },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", them: "Tidak", themNeg: true },
  ],
  reasons: [
    { icon: PiggyBank, title: "Jauh lebih murah", body: "Majoo Starter Rp 249K/bulan (hingga Rp 999K Prime). hivePOS Rp 49K/outlet/bulan dengan outlet pertama gratis. Untuk laundry kecil, Majoo terlalu mahal dan berlebihan." },
    { icon: Layers, title: "Tidak overkill", body: "Majoo adalah suite all-in-one (akunting, HR, inventory berat). hivePOS hanya memberi apa yang usaha laundry benar-benar butuh — tanpa ribet fitur yang tidak terpakai." },
    { icon: MonitorSmartphone, title: "Tanpa bundle hardware", body: "Majoo sering datang dengan bundle tablet/POS. hivePOS cukup dibuka di browser HP, tablet, atau laptop yang sudah ada — nol investasi alat." },
    { icon: Shirt, title: "Khusus laundry", body: "hivePOS dirancang untuk laundry: kiloan, satuan, garment breakdown, WhatsApp order, dan pickup terintegrasi. Bukan POS umum yang dipaksa untuk laundry." },
  ],
  faqs: [
    { q: "Kenapa hivePOS lebih cocok dari Majoo untuk laundry?", a: "Majoo adalah suite all-in-one (akunting, HR) yang mahal dan berat untuk laundry kecil. hivePOS fokus khusus laundry — kiloan, WhatsApp order, pickup, garment breakdown — dengan separuh harga dan outlet pertama gratis." },
    { q: "Bisa pindah dari Majoo ke hivePOS?", a: "Bisa. Setup layanan + harga di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama atau diimpor dari data Anda." },
    { q: "Printer thermal saya bisa dipakai di hivePOS?", a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di Android/PC semua metode didukung; di iPhone/iPad gunakan WiFi atau Browser Print." },
  ],
  keywords: ["alternatif majoo laundry", "majoo vs hivepos", "aplikasi kasir laundry pengganti majoo", "harga majoo vs hivepos"],
};

const kasirpintar: Competitor = {
  slug: "alternatif-kasir-pintar-laundry",
  name: "Kasir Pintar",
  metaTitle: "Alternatif Kasir Pintar untuk Laundry Kiloan | hivePOS",
  metaDescription:
    "Alternatif Kasir Pintar untuk laundry. hivePOS khusus kiloan: harga per kg otomatis, WhatsApp order, pickup, dan garment breakdown. Browser-native, outlet pertama gratis. Mulai Rp 49K/outlet.",
  heroH1: "Alternatif Kasir Pintar untuk Laundry —",
  heroHighlight: "Spesifik Kiloan",
  dek: "Kasir Pintar cocok untuk warung dan retail umum. Untuk usaha laundry, hivePOS lebih tepat: harga kiloan otomatis, WhatsApp order, pickup, dan garment breakdown — semua dari browser. Outlet pertama gratis, mulai Rp 49K/outlet.",
  theirPriceFrom: "Gratis",
  theirPriceUnit: " / berbayar",
  theirCardPoints: ["Kasir umum, bukan laundry", "Kiloan & pickup terbatas", "Free tier fitur dasar"],
  comparison: [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", them: "Gratis (dasar) / berbayar" },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", them: "Gratis terbatas" },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", them: "App Android + web" },
    { feature: "Butuh hardware?", hivepos: "Tidak", them: "Sering bundle Android" },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", them: "Kasir umum", themNeg: true },
    { feature: "WhatsApp order", hivepos: "Built-in + template", them: "Terbatas / add-on", themNeg: true },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", them: "Ya (Bluetooth)" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", them: "Ya (berbayar)" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", them: "Tidak", themNeg: true },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", them: "Tidak", themNeg: true },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", them: "Tidak", themNeg: true },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", them: "Tidak", themNeg: true },
  ],
  reasons: [
    { icon: Shirt, title: "Khusus laundry, bukan kasir umum", body: "Kasir Pintar adalah POS umum untuk warung/retail. hivePOS dirancang untuk laundry: harga kiloan & satuan otomatis per kg, garment breakdown, dan layanan khusus (sepatu, bed cover)." },
    { icon: MessageCircle, title: "WhatsApp + pickup built-in", body: "Kasir Pintar terbatas di sini. hivePOS punya WhatsApp order otomatis + template pesanan, dan pickup/antar-jemput terintegrasi langsung ke order." },
    { icon: PiggyBank, title: "Outlet pertama gratis selamanya", body: "Free tier Kasir Pintar hanya fitur dasar. hivePOS memberi outlet pertama gratis dengan fitur laundry lengkap, lalu Rp 49K/outlet untuk cabang berikutnya." },
    { icon: Globe2, title: "Website laundry (Pro)", body: "hivePOS Pro menyertakan website laundry di slug.hivepos.id dengan SEO lokal Google Maps dan tracking pesanan online. Kasir Pintar tidak punya ini." },
  ],
  faqs: [
    { q: "Apa bedanya hivePOS dan Kasir Pintar untuk laundry?", a: "Kasir Pintar adalah aplikasi kasir umum untuk warung/retail. hivePOS khusus laundry: harga kiloan otomatis, WhatsApp order, pickup/antar-jemput, garment breakdown, dan website laundry. Lebih tepat untuk usaha laundry." },
    { q: "Bisa pindah dari Kasir Pintar ke hivePOS?", a: "Bisa. Setup layanan + harga kiloan di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama." },
    { q: "Printer thermal saya bisa dipakai di hivePOS?", a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di Android/PC semua metode didukung; di iPhone/iPad gunakan WiFi atau Browser Print." },
  ],
  keywords: ["alternatif kasir pintar laundry", "kasir pintar vs hivepos laundry", "aplikasi kasir laundry kiloan", "aplikasi kasir laundry pengganti kasir pintar"],
};

const pawoon: Competitor = {
  slug: "alternatif-pawoon-laundry",
  name: "Pawoon",
  metaTitle: "Alternatif Pawoon untuk Laundry — Lebih Murah | hivePOS Rp 49K/outlet",
  metaDescription:
    "Alternatif Pawoon untuk usaha laundry. Pawoon cloud POS Rp 299K/outlet/bln untuk retail/F&B umum. hivePOS khusus laundry kiloan — WhatsApp order, pickup, garment — dari browser, outlet pertama gratis, Rp 49K/outlet.",
  heroH1: "Alternatif Pawoon untuk Laundry —",
  heroHighlight: "Lebih Murah & Fokus",
  dek: "Pawoon adalah cloud POS untuk retail dan F&B umum (Rp 299K/outlet/bulan). Untuk usaha laundry, hivePOS lebih tepat dan jauh lebih murah — khusus kiloan, WhatsApp order, pickup, dan garment breakdown, semuanya dari browser. Outlet pertama gratis, mulai Rp 49K/outlet.",
  theirPriceFrom: "Rp 299K",
  theirPriceUnit: "/outlet/bln",
  theirCardPoints: ["Rp 299K/outlet/bulan", "POS umum retail & F&B", "WhatsApp & pickup terbatas"],
  comparison: [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", them: "Rp 299K/outlet/bulan", themNeg: true },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", them: "Berbayar", themNeg: true },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", them: "Cloud POS (app)" },
    { feature: "Butuh hardware?", hivepos: "Tidak", them: "Opsional" },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", them: "Umum (retail/F&B)" },
    { feature: "WhatsApp order", hivepos: "Built-in + template", them: "Terbatas / add-on", themNeg: true },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", them: "Ya" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", them: "Ya (mahal)" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", them: "Tidak", themNeg: true },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", them: "Tidak", themNeg: true },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", them: "Tidak", themNeg: true },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", them: "Cloud (butuh internet)", themNeg: true },
  ],
  reasons: [
    { icon: PiggyBank, title: "6× lebih murah", body: "Pawoon Rp 299K/outlet/bulan. hivePOS Rp 49K/outlet/bulan dengan outlet pertama gratis selamanya. Untuk 1 outlet, hemat lebih dari Rp 250K/bulan." },
    { icon: Shirt, title: "Khusus laundry, bukan POS umum", body: "Pawoon dirancang untuk retail dan F&B umum. hivePOS khusus laundry: harga kiloan & satuan otomatis, garment breakdown, WhatsApp order, dan pickup terintegrasi." },
    { icon: MessageCircle, title: "WhatsApp + pickup built-in", body: "Di Pawoon, WhatsApp dan pickup terbatas atau butuh add-on. hivePOS punya WhatsApp order otomatis + template pesanan serta pickup/antar-jemput langsung dari order." },
    { icon: Globe2, title: "Website laundry (Pro)", body: "hivePOS Pro menyertakan website laundry di slug.hivepos.id dengan SEO lokal Google Maps dan tracking pesanan online. Pawoon tidak menyediakan ini." },
  ],
  faqs: [
    { q: "Apakah hivePOS bisa menggantikan Pawoon untuk laundry?", a: "Ya. hivePOS punya semua yang Pawoon tawarkan untuk kasir (transaksi, struk, laporan, multi-outlet) PLUS fitur khusus laundry yang Pawoon tidak punya: kiloan pricing, WhatsApp order built-in, pickup, garment breakdown, dan website laundry." },
    { q: "Bisa pindah dari Pawoon ke hivePOS?", a: "Bisa. Setup layanan + harga kiloan di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama atau diimpor dari data Pawoon Anda." },
    { q: "Printer thermal saya bisa dipakai di hivePOS?", a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di Android/PC semua metode didukung; di iPhone/iPad gunakan WiFi atau Browser Print." },
  ],
  keywords: ["alternatif pawoon laundry", "pawoon vs hivepos", "aplikasi kasir laundry pengganti pawoon", "harga pawoon vs hivepos"],
};

const iseller: Competitor = {
  slug: "alternatif-iseller-laundry",
  name: "iSeller",
  metaTitle: "Alternatif iSeller untuk Laundry — Lebih Simpel & Murah | hivePOS",
  metaDescription:
    "Alternatif iSeller untuk usaha laundry. iSeller platform omnichannel mulai Rp 300K/bln — lengkap tapi kompleks. hivePOS fokus khusus laundry kiloan dari browser, separuh harga. Outlet pertama gratis.",
  heroH1: "Alternatif iSeller untuk Laundry —",
  heroHighlight: "Lebih Simpel & Murah",
  dek: "iSeller adalah platform omnichannel untuk retail dan F&B (mulai Rp 300K/bulan) — lengkap tapi kompleks dan mahal untuk laundry kecil. hivePOS fokus khusus laundry kiloan dari browser: WhatsApp order, pickup, dan garment breakdown. Separuh harganya, outlet pertama gratis.",
  theirPriceFrom: "Rp 300K",
  theirPriceUnit: "/bln",
  theirCardPoints: ["Mulai Rp 300K/bulan", "Omnichannel, kompleks untuk laundry", "Tidak khusus kiloan"],
  comparison: [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", them: "Rp 300K/bulan", themNeg: true },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", them: "Berbayar", themNeg: true },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", them: "App + omnichannel" },
    { feature: "Butuh hardware?", hivepos: "Tidak", them: "Opsional" },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", them: "Umum (retail/F&B/omnichannel)" },
    { feature: "WhatsApp order", hivepos: "Built-in + template", them: "Terbatas", themNeg: true },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", them: "Ya" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", them: "Ya" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", them: "Tidak", themNeg: true },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", them: "Tidak", themNeg: true },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", them: "Tidak", themNeg: true },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", them: "Tidak", themNeg: true },
  ],
  reasons: [
    { icon: PiggyBank, title: "Jauh lebih murah", body: "iSeller mulai Rp 300K/bulan. hivePOS Rp 49K/outlet/bulan dengan outlet pertama gratis selamanya. Untuk laundry kecil, iSeller terlalu mahal." },
    { icon: Layers, title: "Lebih simpel, tidak overkill", body: "iSeller adalah platform omnichannel (integrasi marketplace, inventory kompleks). hivePOS hanya memberi apa yang usaha laundry butuh — tanpa ribet fitur yang tidak terpakai." },
    { icon: Shirt, title: "Khusus laundry", body: "hivePOS dirancang untuk laundry: kiloan, satuan, garment breakdown, WhatsApp order, dan pickup terintegrasi. Bukan POS umum yang dipaksa untuk laundry." },
    { icon: Globe2, title: "Website laundry (Pro)", body: "hivePOS Pro menyertakan website laundry di slug.hivepos.id dengan SEO lokal Google Maps dan tracking pesanan online. iSeller tidak menyediakan ini." },
  ],
  faqs: [
    { q: "Kenapa hivePOS lebih cocok dari iSeller untuk laundry?", a: "iSeller adalah platform omnichannel yang lengkap tapi mahal dan kompleks untuk laundry kecil. hivePOS fokus khusus laundry — kiloan, WhatsApp order, pickup, garment breakdown — dengan separuh harga dan outlet pertama gratis." },
    { q: "Bisa pindah dari iSeller ke hivePOS?", a: "Bisa. Setup layanan + harga kiloan di hivePOS cuma butuh 2 menit. Pelanggan bisa diketik saat order pertama atau diimpor dari data Anda." },
    { q: "Printer thermal saya bisa dipakai di hivePOS?", a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di Android/PC semua metode didukung; di iPhone/iPad gunakan WiFi atau Browser Print." },
  ],
  keywords: ["alternatif iseller laundry", "iseller vs hivepos", "aplikasi kasir laundry pengganti iseller", "harga iseller vs hivepos"],
};

const qasir: Competitor = {
  slug: "alternatif-qasir-laundry",
  name: "Qasir",
  metaTitle: "Alternatif Qasir untuk Laundry — Bebas Pindah Perangkat | hivePOS",
  metaDescription:
    "Alternatif Qasir untuk laundry. Qasir kasir Android terkunci 1 perangkat & umum. hivePOS jalan di browser apa saja — HP/tablet/PC — khusus kiloan, WhatsApp order, pickup. Outlet pertama gratis, Rp 49K/outlet.",
  heroH1: "Alternatif Qasir untuk Laundry —",
  heroHighlight: "Bebas Pindah Perangkat",
  dek: "Qasir adalah kasir Android yang terjangkau, tapi terkunci ke satu perangkat dan bersifat umum (bukan laundry). hivePOS jalan di browser apa saja — HP, tablet, atau PC — khusus kiloan dengan WhatsApp order, pickup, dan garment breakdown. Outlet pertama gratis, mulai Rp 49K/outlet.",
  theirPriceFrom: "~Rp 58K",
  theirPriceUnit: "/bln (tahunan)",
  theirCardPoints: ["Terkunci 1 perangkat Android", "Kasir umum, bukan laundry", "Tidak ada pickup/website laundry"],
  comparison: [
    { feature: "Harga mulai", hivepos: "Rp 49K/outlet/bulan", them: "~Rp 58K/bln (Pro tahunan)" },
    { feature: "Outlet pertama", hivepos: "Gratis selamanya", them: "Trial / berbayar" },
    { feature: "Platform", hivepos: "Browser (HP/tablet/PC)", them: "App Android (terkunci device)" },
    { feature: "Butuh hardware?", hivepos: "Tidak", them: "Terkunci 1 perangkat Android", themNeg: true },
    { feature: "Khusus laundry (kiloan)", hivepos: "Ya — kiloan, satuan, garment", them: "Kasir umum", themNeg: true },
    { feature: "WhatsApp order", hivepos: "Built-in + template", them: "Terbatas", themNeg: true },
    { feature: "Cetak struk thermal", hivepos: "BT/USB/WiFi/Browser", them: "Bluetooth (Android)" },
    { feature: "Multi-outlet", hivepos: "Unlimited (Growth+)", them: "Ya (berbayar)" },
    { feature: "Pickup/antar-jemput", hivepos: "Built-in", them: "Tidak", themNeg: true },
    { feature: "Website laundry", hivepos: "Pro (slug.hivepos.id)", them: "Tidak", themNeg: true },
    { feature: "Bukti foto order", hivepos: "Pro (sebelum/sesudah)", them: "Tidak", themNeg: true },
    { feature: "PWA (install di HP)", hivepos: "Ya, offline mode", them: "App Android (offline)" },
  ],
  reasons: [
    { icon: MonitorSmartphone, title: "Jalan di semua perangkat", body: "Qasir terkunci ke satu perangkat Android. hivePOS jalan di browser apa saja — HP Android/iPhone, tablet, atau PC — dan bisa berpindah perangkat kapan saja tanpa kehilangan data." },
    { icon: Shirt, title: "Khusus laundry, bukan kasir umum", body: "Qasir adalah aplikasi kasir umum. hivePOS dirancang untuk laundry: harga kiloan & satuan otomatis per kg, garment breakdown, dan layanan khusus (sepatu, bed cover)." },
    { icon: MessageCircle, title: "WhatsApp + pickup built-in", body: "hivePOS punya WhatsApp order otomatis + template pesanan serta pickup/antar-jemput terintegrasi langsung ke order — yang Qasir tidak sediakan." },
    { icon: PiggyBank, title: "Outlet pertama gratis selamanya", body: "Qasir hanya memberi trial lalu berbayar. hivePOS memberi outlet pertama gratis dengan fitur laundry lengkap, lalu Rp 49K/outlet untuk cabang berikutnya." },
  ],
  faqs: [
    { q: "Apa bedanya hivePOS dan Qasir untuk laundry?", a: "Qasir adalah kasir Android umum yang terkunci ke satu perangkat. hivePOS jalan di browser apa saja dan khusus laundry: harga kiloan otomatis, WhatsApp order, pickup/antar-jemput, garment breakdown, dan website laundry." },
    { q: "Bisa pindah dari Qasir ke hivePOS tanpa ganti perangkat?", a: "Bisa, dan justru lebih fleksibel. hivePOS dibuka di browser HP, tablet, atau PC apa pun — tidak terkunci ke satu perangkat. Setup layanan + harga kiloan cuma butuh 2 menit." },
    { q: "Printer thermal saya bisa dipakai di hivePOS?", a: "Ya. hivePOS mendukung printer thermal 58mm dan 80mm via Bluetooth, USB, dan WiFi. Di Android/PC semua metode didukung; di iPhone/iPad gunakan WiFi atau Browser Print." },
  ],
  keywords: ["alternatif qasir laundry", "qasir vs hivepos laundry", "aplikasi kasir laundry kiloan", "aplikasi kasir laundry pengganti qasir"],
};

export const COMPETITORS: Competitor[] = [moka, olsera, majoo, kasirpintar, pawoon, iseller, qasir];

export function getCompetitor(slug: string): Competitor | undefined {
  return COMPETITORS.find((c) => c.slug === slug);
}

export function competitorMetadata(c: Competitor): Metadata {
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `/${c.slug}` },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: `${SITE}/${c.slug}`,
      type: "website",
      locale: "id_ID",
    },
    keywords: c.keywords,
  };
}
