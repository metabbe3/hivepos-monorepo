import {
  BarChart3,
  Building2,
  Users,
  Wallet,
  Printer,
  Smartphone,
  Bell,
  Shield,
  Receipt,
  WashingMachine,
  Globe,
  Palette,
  Image as ImageIcon,
  Search,
  MapPin,
  HelpCircle,
  Package,
  MessageCircle,
  QrCode,
  Star,
  Quote,
  Clock,
  Instagram,
  Truck,
  type LucideIcon,
} from "lucide-react";

/* ─────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────── */

export interface SaasStat {
  value: string;
  label: string;
}

export interface SaasIndustry {
  icon: LucideIcon;
  name: string;
  tagline: string;
  features: string[];
  status: string;
  available: boolean;
}

export interface SaasFeature {
  icon: LucideIcon;
  title: string;
  desc: string;
  /** Tailwind col-span class for bento layout, e.g. "md:col-span-2". */
  span: string;
  /** Optional decorative visual for spanning cards. */
  visual?: "chart" | "receipt";
}

export interface SaasPricingPlan {
  name: string;
  price: string;
  /** Optional struck-through original price (e.g. "Rp 79K" for Growth). */
  originalPrice?: string;
  /** Optional discount chip text (e.g. "HEMAT 38%"). */
  discount?: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  highlight: boolean;
}

export interface SaasFaq {
  q: string;
  a: string;
}

export interface SaasStep {
  num: string;
  title: string;
  desc: string;
}

export type WebsiteFeatureGroup =
  | "Branding & Subdomain"
  | "SEO Lokal"
  | "Tracking & Pembayaran"
  | "Kepercayaan & Konten";

export interface WebsiteFeature {
  group: WebsiteFeatureGroup;
  icon: LucideIcon;
  title: string;
  desc: string;
}

/* ─────────────────────────────────────────────────────────────
   Data
   ───────────────────────────────────────────────────────────── */

// ponytail: real snapshot from Honey Bee Laundry (our own dogfooding tenant)
// captured Jun 2026. Hardcoded — not wired live — revisit when numbers shift
// materially (e.g. +50% growth). Skip revenue per founder's call.
export const SAAS_STATS: SaasStat[] = [
  { value: "443", label: "Pelanggan Aktif" },
  { value: "199", label: "Order Total" },
  { value: "Okt 2024", label: "Laundry Berjalan" },
  { value: "Jun 2026", label: "Di hivePOS" },
];

export const SAAS_PAYMENT_METHODS: string[] = [
  "QRIS",
  "GoPay",
  "OVO",
  "DANA",
  "ShopeePay",
  "BCA",
  "Mandiri",
  "Cash",
];

export const SAAS_INDUSTRIES: SaasIndustry[] = [
  {
    icon: WashingMachine,
    name: "Laundry",
    tagline: "Kiloan, satuan, express",
    features: [
      "Pricing per kg, per item, atau paket",
      "Kanban board status tracking",
      "Deposit wallet untuk pelanggan",
      "SLA tracker untuk order express",
      "WhatsApp order button",
    ],
    status: "Tersedia",
    available: true,
  },
  // ponytail: FnB and Salon entries removed from landing — focus brand on laundry
  // until those modules ship. Re-add here (and in LandingFooter) when ready.
];

export const SAAS_FEATURES: SaasFeature[] = [
  {
    icon: BarChart3,
    title: "Pantau dari HP",
    desc: "Pendapatan, order hari ini, performa outlet, semua otomatis. Buka di HP, tablet, atau laptop.",
    span: "md:col-span-2",
    visual: "chart",
  },
  {
    icon: Building2,
    title: "Tumbuh ke Cabang",
    desc: "Mulai dari 1 outlet, tambah cabang kapan saja. Per-outlet stats, per-outlet staff, satu akun.",
    span: "",
  },
  {
    icon: Wallet,
    title: "Bayar Apa Aja",
    desc: "Cash, QRIS, GoPay, OVO, DANA, transfer, deposit. Kasir terima semua tanpa setup tambahan.",
    span: "",
  },
  {
    icon: Users,
    title: "Kasir vs Owner",
    desc: "Owner lihat semua. Kasir cuma bikin order. Staff gudang cuma update status. Kontrol akses sesuai peran.",
    span: "",
  },
  {
    icon: Printer,
    title: "Print Struk Langsung",
    desc: "Printer thermal 58mm atau 80mm, langsung dari browser. Auto-detect printer di jaringan. Logo laundry di kepala struk.",
    span: "md:col-span-2",
    visual: "receipt",
  },
  {
    icon: Smartphone,
    title: "Jalan di Apa Aja",
    desc: "HP Android, iPhone, tablet, laptop. hivePOS jalan di browser apapun. Tanpa install app.",
    span: "",
  },
  {
    icon: Bell,
    title: "Order via WhatsApp",
    desc: "Pelanggan pesan langsung dari chat WA. Tanpa app tambahan, tanpa biaya API.",
    span: "",
  },
  {
    icon: Shield,
    title: "Data Aman",
    desc: "Password di-hash, transaksi terenkripsi, setiap tenant terpisah. Standar yang sama dengan layanan banking online.",
    span: "",
  },
  {
    icon: Receipt,
    title: "Lacak Piutang",
    desc: "Siapa yang masih hutang? Dashboard kasih tau. Reminder otomatis, gabung sama laporan keuangan.",
    span: "md:col-span-2",
  },
  {
    icon: ImageIcon,
    title: "Bukti Foto Order",
    desc: "Foto sebelum & sesudah cucian, bukti transparan untuk pelanggan, tampil di halaman tracking. Otomatis terhapus 7 hari. Fitur Pro.",
    span: "",
  },
];

export const SAAS_HOW_IT_WORKS: SaasStep[] = [
  {
    num: "01",
    title: "Daftar di 2 Menit",
    desc: "Isi nama bisnis dan jenis usaha. Gratis, tanpa kartu kredit, langsung jalan.",
  },
  {
    num: "02",
    title: "Atur Layanan & Harga",
    desc: "Masukin layanan kiloan, satuan, dan express. Tambah harga, staff, dan import pelanggan lama.",
  },
  {
    num: "03",
    title: "Buka Kasir",
    desc: "Tinggal buka browser, langsung terima order dan pembayaran. Dashboard real-time menyusul.",
  },
];

// ponytail: these mirror lib/billing.ts (PRICE_PER_OUTLET=49000, ORIGINAL=79000, PRO=79000)
// so the landing page can't drift from the real billing UI. If those constants change,
// update here too.
export const SAAS_PRICING: SaasPricingPlan[] = [
  {
    name: "Free",
    price: "Rp 0",
    period: "/bulan",
    desc: "Untuk laundry yang baru mulai",
    features: [
      "1 Outlet, 2 Staff, 100 Order/bulan",
      "Kasir lengkap: kiloan, satuan, garment",
      "Bayar: Cash, QRIS, Transfer, Deposit",
      "Cetak struk thermal (BT/USB/WiFi)",
      "Manajemen pelanggan + dompet deposit",
      "Dashboard real-time",
      "Laporan dasar (omzet, order, layanan)",
      "WhatsApp order + template pesanan",
      "Pickup / antar-jemput",
      "PWA: install di HP, order offline",
      "Halaman tracking untuk pelanggan",
    ],
    cta: "Mulai Gratis",
    highlight: false,
  },
  {
    name: "Growth",
    price: "Rp 49K",
    period: "/outlet/bulan",
    desc: "Untuk laundry yang siap tumbuh",
    features: [
      "Semua fitur Free",
      "Unlimited Outlet, Staff & Order",
      "Laporan lengkap (heatmap, SLA, arus kas)",
      "Dashboard multi-outlet",
      "Inventory + alert stok menipis",
      "Catat pengeluaran",
      "Custom branding",
      "Priority support",
    ],
    cta: "Coba Gratis 14 Hari",
    highlight: false,
  },
  {
    name: "Pro",
    price: "Rp 79K",
    period: "/outlet/bulan",
    desc: "Website + bukti foto, semua fitur",
    features: [
      "Semua fitur Growth",
      "Website laundry sendiri (slug.hivepos.id)",
      "SEO lokal (Google Maps, schema.org)",
      "Template profesional + branding kustom",
      "Tracking pesanan online untuk pelanggan",
      "Bukti foto order (sebelum & sesudah)",
      "QRIS display di website",
    ],
    cta: "Coba Gratis 14 Hari",
    highlight: true,
  },
];

export const SAAS_FAQS: SaasFaq[] = [
  {
    q: "Apakah hivePOS benar-benar dipakai sendiri?",
    a: "Ya. hivePOS aktif dipakai di Honey Bee Laundry (laundry kami sendiri) sejak Juni 2026. Setiap fitur kami tes di laundry nyata sebelum dirilis. Berita bug dan keluhan → langsung ke kami, bukan ke tiket support yang hilang.",
  },
  {
    q: "Apakah benar-benar gratis?",
    a: "Gratis 1 outlet selamanya, tanpa kartu kredit. Growth & Pro bisa dicoba gratis 14 hari, aktif langsung tanpa persetujuan admin. Outlet kedua dan seterusnya Rp 49K/outlet/bulan, upgrade kapan saja.",
  },
  {
    q: "Berapa lama sampai jalan?",
    a: "2 menit. Daftar → isi nama bisnis → tambah layanan → buka kasir. Tanpa install, tanpa setting hardware, tanpa training staff berhari-hari.",
  },
  {
    q: "Apakah saya butuh internet 24/7?",
    a: "Cukup koneksi stabil saat transaksi. WhatsApp order dan tracking tetap bisa diakses pelanggan bahkan kalau sinyal Anda sedang down. Begitu internet balik, data sinkron otomatis.",
  },
  {
    q: "Bisakah pindah dari kasir lain?",
    a: "Bisa, tapi jujur, kalau kasir lama Anda bisa export Excel (pelanggan, layanan, harga), kami bantu import. Kalau tidak bisa export atau formatnya beda, Anda input manual lewat hivePOS. Setup layanan + harga cuma butuh 2 menit, dan pelanggan bisa diketik saat order pertama. Tidak perlu pindah semua data sekaligus.",
  },
  {
    q: "Apakah mendukung printer thermal?",
    a: "Ya, 58mm dan 80mm. Auto-detect printer di jaringan yang sama, tanpa driver tambahan. Logo dan footer struk bisa custom.",
  },
  {
    q: "Apakah bisa cetak struk di iPhone/iPad?",
    a: "Cetak struk thermal via Bluetooth/USB tidak didukung di iPhone/iPad (Safari memblokir akses Bluetooth/USB). Tapi Anda tetap bisa cetak via WiFi/LAN (printer yang terhubung jaringan) atau Browser Print. Untuk Bluetooth/USB, gunakan Chrome atau Edge di Android atau PC.",
  },
  {
    q: "Apakah bisa simpan foto bukti cucian?",
    a: "Ya, di paket Pro. Foto sebelum & sesudah cucian jadi bukti transparan, pelanggan bisa lihat langsung di halaman tracking mereka. Foto disimpan 7 hari lalu dihapus otomatis supaya penyimpanan tetap ringan dan privasi pelanggan terjaga.",
  },
  {
    q: "Apakah cocok untuk laundry kecil?",
    a: "Cocok banget. hivePOS dirancang untuk UMKM laundry, mulai dari 1 outlet dengan 1-2 staff sampai 5+ cabang. Tidak overengineered untuk laundry kecil, tidak underpowered untuk yang tumbuh.",
  },
];

export const SAAS_NAV_LINKS = [
  { href: "#fitur", label: "Fitur" },
  { href: "#modul", label: "Modul" },
  { href: "#harga", label: "Harga" },
  { href: "#faq", label: "FAQ" },
  { href: "/blog", label: "Blog" },
] as const;

// ── Website (Pro) features ──
// ponytail: single source of truth for what "Website laundry sendiri" buys.
// Surfaced on landing spotlight + billing upsell so copy can't drift.
// customDomain reserved for Enterprise — add when that tier ships.
export const WEBSITE_FEATURES: WebsiteFeature[] = [
  // Branding & Subdomain
  { group: "Branding & Subdomain", icon: Globe,
    title: "Subdomain sendiri",
    desc: "URL profesional slug.hivepos.id untuk setiap outlet." },
  { group: "Branding & Subdomain", icon: Palette,
    title: "Template profesional",
    desc: "Layout editorial yang clean, mobile-first, siap pakai." },
  { group: "Branding & Subdomain", icon: ImageIcon,
    title: "Branding kustom",
    desc: "Tagline, hero photo, about text, logo, warna brand." },

  // SEO Lokal
  { group: "SEO Lokal", icon: Search,
    title: "Schema.org LocalBusiness",
    desc: "Google membaca jam buka, alamat, rating, harga, langsung." },
  { group: "SEO Lokal", icon: MapPin,
    title: "Google Maps integration",
    desc: "Peta interaktif + schema latitude/longitude untuk local search." },
  { group: "SEO Lokal", icon: HelpCircle,
    title: "FAQ markup",
    desc: "Schema FAQPage biar halaman sering muncul di featured snippet." },

  // Tracking & Pembayaran
  { group: "Tracking & Pembayaran", icon: Package,
    title: "Tracking pesanan online",
    desc: "Pelanggan cek status pesanan via nomor order, self-service." },
  { group: "Tracking & Pembayaran", icon: MessageCircle,
    title: "Tombol WhatsApp order",
    desc: "Deep link ke WhatsApp dengan template pesanan otomatis." },
  { group: "Tracking & Pembayaran", icon: QrCode,
    title: "QRIS display",
    desc: "Tampilkan QRIS di website untuk pembayaran instan." },

  // Kepercayaan & Konten
  { group: "Kepercayaan & Konten", icon: Star,
    title: "Trust signals",
    desc: "Google rating, tahun berdiri, waktu proses, area layanan." },
  { group: "Kepercayaan & Konten", icon: Quote,
    title: "Testimoni pelanggan",
    desc: "Review rich results untuk bintang di Google SERP." },
  { group: "Kepercayaan & Konten", icon: Clock,
    title: "Jam operasional",
    desc: "Indikator 'Buka Sekarang' + schema openingHours." },
  { group: "Kepercayaan & Konten", icon: Instagram,
    title: "Sosial media link",
    desc: "Instagram + WhatsApp link di header dan footer." },
  { group: "Kepercayaan & Konten", icon: Truck,
    title: "Form pickup",
    desc: "Pelanggan booking antar-jemput langsung dari website." },
];

export const WEBSITE_FEATURE_GROUPS: { name: WebsiteFeatureGroup; icon: LucideIcon }[] = [
  { name: "Branding & Subdomain", icon: Globe },
  { name: "SEO Lokal", icon: Search },
  { name: "Tracking & Pembayaran", icon: Package },
  { name: "Kepercayaan & Konten", icon: Star },
];
