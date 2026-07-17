export interface BlogSection {
  heading: string;
  body: string[];
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  keywords: string;
  publishedAt: string;
  readTime: string;
  sections: BlogSection[];
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "fitur-wajib-aplikasi-kasir-laundry",
    title: "5 Fitur Wajib Aplikasi Kasir Laundry 2026",
    description:
      "Fitur penting yang harus ada di aplikasi kasir laundry: sistem kiloan, WhatsApp order, multi-outlet, struk thermal, dan laporan penjualan.",
    keywords: "fitur aplikasi kasir laundry, software kasir laundry, aplikasi laundry",
    publishedAt: "2026-06-29",
    readTime: "4 menit",
    sections: [
      {
        heading: "Mengapa Aplikasi Kasir Laundry Penting?",
        body: [
          "Bisnis laundry di Indonesia tumbuh pesat, tetapi banyak pemilik usaha masih mengandalkan pencatatan manual atau Excel. Aplikasi kasir laundry yang tepat dapat menghemat waktu, mengurangi kesalahan, dan meningkatkan kepuasan pelanggan.",
          "Berikut 5 fitur wajib yang harus dimiliki setiap aplikasi kasir laundry pada tahun 2026.",
        ],
      },
      {
        heading: "1. Sistem Harga Kiloan dan Satuan",
        body: [
          "Laundry memiliki dua model harga utama: kiloan (per kg) dan satuan (per potong). Aplikasi kasir laundry harus mendukung keduanya dengan fleksibel — pelanggan bisa mencampur kiloan dan satuan dalam satu transaksi.",
          "hivePOS mendukung harga kiloan, satuan, paket membership, dan layanan khusus (sepatu, bed cover, karpet) dalam satu struk.",
        ],
      },
      {
        heading: "2. Integrasi WhatsApp untuk Order",
        body: [
          "Pelanggan laundry di Indonesia lebih suka order via WhatsApp daripada aplikasi terpisah. Aplikasi kasir laundry yang baik harus bisa menerima order WhatsApp langsung masuk ke sistem — tanpa copy-paste manual.",
          "hivePOS mengubah setiap chat WhatsApp menjadi order otomatis dengan detail pelanggan, jenis layanan, dan estimasi selesai.",
        ],
      },
      {
        heading: "3. Multi-Outlet dan Sinkronisasi",
        body: [
          "Untuk laundry yang berkembang ke beberapa cabang, aplikasi kasir harus mendukung multi-outlet dengan dashboard terpusat. Pemilik bisa memantau penjualan setiap cabang secara real-time.",
          "hivePOS mendukung multi-outlet tanpa biaya tambahan per cabang (mulai Rp 49K/outlet/bulan).",
        ],
      },
      {
        heading: "4. Cetak Struk Thermal Printer",
        body: [
          "Struk fisik masih penting di laundry — pelanggan butuh bukti serah terima. Aplikasi kasir laundry harus mendukung cetak struk thermal via Bluetooth, USB, atau WiFi/LAN.",
          "hivePOS mendukung 4 metode cetak: Bluetooth, USB Serial, WiFi/LAN, dan Browser Print.",
        ],
      },
      {
        heading: "5. Laporan Penjualan dan Analitik",
        body: [
          "Data penjualan harian, mingguan, dan bulanan membantu pemilik laundry membuat keputusan: kapan peak hours, layanan mana yang paling laku, dan berapa pendapatan per kilogram.",
          "hivePOS menyediakan laporan otomatis: pendapatan harian, transaksi per layanan, pelanggan top, dan tren pertumbuhan.",
        ],
      },
      {
        heading: "Kesimpulan",
        body: [
          "Memilih aplikasi kasir laundry dengan 5 fitur di atas akan menghemat waktu operasional dan meningkatkan profit. hivePOS menyediakan semua fitur ini gratis untuk 1 outlet.",
          "Coba hivePOS sekarang — gratis, tanpa instalasi, langsung jalan di browser.",
        ],
      },
    ],
  },
  {
    slug: "harga-software-kasir-laundry-2026",
    title: "Harga Software Kasir Laundry: Panduan Lengkap 2026",
    description:
      "Berapa harga software kasir laundry di Indonesia? Perbandingan Moka POS, Olsera, dan hivePOS. Tips memilih yang termurah tanpa mengorbankan fitur.",
    keywords: "harga software kasir laundry, harga aplikasi kasir laundry, software laundry murah",
    publishedAt: "2026-06-29",
    readTime: "5 menit",
    sections: [
      {
        heading: "Berapa Harga Software Kasir Laundry?",
        body: [
          "Harga software kasir laundry di Indonesia bervariasi dari gratis hingga ratusan ribu rupiah per bulan. Harga tergantung fitur, jumlah outlet, dan model langganan.",
          "Berikut panduan lengkap harga software kasir laundry di tahun 2026.",
        ],
      },
      {
        heading: "Model Harga: Bulanan vs Sekali Bayar",
        body: [
          "Software kasir laundry umumnya menggunakan model SaaS (langganan bulanan). Keuntungan: update otomatis, support, dan tidak perlu server sendiri.",
          "Beberapa software menawarkan bayar sekali (lifetime), tetapi biasanya tidak dapat update + support jangka panjang.",
        ],
      },
      {
        heading: "Perbandingan Harga 2026",
        body: [
          "Moka POS: mulai ~Rp 169K/bulan per outlet. Fitur lengkap tapi mahal untuk UMKM laundry.",
          "Olsera: mulai ~Rp 149K/bulan. Cocok untuk retail tapi kurang spesifik laundry.",
          "hivePOS: gratis untuk 1 outlet, Rp 49K/outlet untuk multi-outlet. Browser-native, tanpa instalasi.",
        ],
      },
      {
        heading: "Biaya Tersembunyi yang Harus Diperhatikan",
        body: [
          "Beberapa software kasir laundry memiliki biaya tersembunyi: biaya setup, biaya training, biaya per user, atau biaya tambahan untuk modul tertentu (WhatsApp, laporan, multi-outlet).",
          "Pastikan bertanya tentang semua biaya sebelum berlangganan. hivePOS tidak ada biaya tersembunyi — semua fitur termasuk dalam paket.",
        ],
      },
      {
        heading: "Tips Memilih Software Kasir Laundry Termurah",
        body: [
          "1. Pastikan fitur laundry (kiloan, satuan) sudah include — jangan add-on berbayar.",
          "2. Cek apakah multi-outlet gratis atau berbayar.",
          "3. Apakah butuh instalasi atau browser-based? Browser-based = tidak perlu beli hardware tambahan.",
          "4. Apakah ada free trial atau paket gratis permanen? hivePOS gratis untuk 1 outlet selamanya.",
        ],
      },
      {
        heading: "Kesimpulan",
        body: [
          "Untuk UMKM laundry, hivePOS adalah pilihan termurah: gratis 1 outlet, Rp 49K/outlet untuk multi-outlet, tanpa biaya tersembunyi, dan tanpa instalasi.",
          "Bandingkan sendiri dan coba gratis di hivepos.id.",
        ],
      },
    ],
  },
  {
    slug: "cara-memilih-aplikasi-kasir-laundry",
    title: "Cara Memilih Aplikasi Kasir Laundry yang Tepat",
    description:
      "Panduan memilih aplikasi kasir laundry untuk UMKM Indonesia. 7 kriteria penting: fitur kiloan, harga, kemudahan, WhatsApp, struk, laporan, dan support.",
    keywords: "cara memilih aplikasi kasir laundry, tips beli software laundry, aplikasi POS laundry",
    publishedAt: "2026-06-29",
    readTime: "5 menit",
    sections: [
      {
        heading: "Tantangan Memilih Aplikasi Kasir Laundry",
        body: [
          "Banyak pilihan aplikasi kasir laundry di pasaran — Moka, Olsera, iSeller, hivePOS, dan lainnya. Mana yang tepat untuk bisnis laundry Anda?",
          "Berikut 7 kriteria yang harus Anda evaluasi sebelum memilih.",
        ],
      },
      {
        heading: "1. Spesifik Laundry atau General POS?",
        body: [
          "General POS (seperti Moka, Olsera) dirancang untuk retail/F&B. Aplikasi yang spesifik laundry (seperti hivePOS) memahami kebutuhan unik: harga kiloan, layanan satuan, membership, estimasi waktu selesai.",
          "Pilih yang spesifik laundry jika bisnis Anda fokus pada layanan cuci.",
        ],
      },
      {
        heading: "2. Berapa Harga Real (Termasuk Hidden Cost)?",
        body: [
          "Cek harga per outlet, biaya per user, biaya modul tambahan, dan biaya setup. Software yang terlihat murah bisa jadi mahal setelah add-on.",
          "hivePOS transparan: gratis 1 outlet, Rp 49K/outlet tambahan, semua fitur termasuk.",
        ],
      },
      {
        heading: "3. Butuh Instalasi atau Browser-Based?",
        body: [
          "Software yang butuh instalasi (desktop app) merepotkan: update manual, kompatibilitas OS, tidak bisa akses dari device lain. Browser-based (seperti hivePOS) jalan di semua device dengan browser — tanpa instalasi.",
          "Browser-based juga memungkinkan akses dari HP, tablet, atau komputer lain.",
        ],
      },
      {
        heading: "4. Integrasi WhatsApp",
        body: [
          "WhatsApp adalah channel utama order laundry di Indonesia. Pastikan aplikasi bisa menerima order WhatsApp langsung masuk sistem — bukan hanya notifikasi.",
        ],
      },
      {
        heading: "5. Cetak Struk Thermal",
        body: [
          "Pastikan mendukung printer thermal yang Anda punya (Bluetooth, USB, atau WiFi). Beberapa software hanya support merek tertentu.",
        ],
      },
      {
        heading: "6. Laporan dan Analitik",
        body: [
          "Laporan penjualan harian, pelanggan top, dan tren layanan membantu Anda mengoptimalkan bisnis. Pastikan laporan mudah dibaca + bisa export.",
        ],
      },
      {
        heading: "7. Support dan Komunitas",
        body: [
          "Software laundry lokal (Indonesia) biasanya punya support dalam Bahasa Indonesia + komunitas pengguna. Ini penting saat ada masalah teknis.",
        ],
      },
      {
        heading: "Rekomendasi",
        body: [
          "Untuk UMKM laundry yang mencari aplikasi kasir spesifik laundry, browser-based, terjangkau, dan dengan integrasi WhatsApp — hivePOS adalah pilihan terbaik.",
          "Coba gratis tanpa registrasi kartu kredit di hivepos.id.",
        ],
      },
    ],
  },
  {
    slug: "sistem-kasir-kiloan-cara-kerja",
    title: "Sistem Kasir Kiloan: Cara Kerja dan Tips Optimasi",
    description:
      "Bagaimana sistem kasir kiloan bekerja di bisnis laundry? Panduan lengkap harga per kilogram, perhitungan otomatis, dan tips optimasi profit kiloan.",
    keywords: "sistem kasir kiloan, harga cuci kiloan, kasir laundry kiloan",
    publishedAt: "2026-06-29",
    readTime: "4 menit",
    sections: [
      {
        heading: "Apa Itu Sistem Kasir Kiloan?",
        body: [
          "Sistem kasir kiloan adalah metode penjualan laundry berdasarkan berat (per kilogram). Pelanggan membayar sesuai berat cucian, bukan per potong.",
          "Sistem ini populer di Indonesia karena simple dan transparan untuk pelanggan.",
        ],
      },
      {
        heading: "Cara Kerja Sistem Kiloan",
        body: [
          "1. Timbang cucian pelanggan (timbangan digital).",
          "2. Masukkan berat ke aplikasi kasir (contoh: 3.5 kg).",
          "3. Sistem menghitung harga otomatis (3.5 kg × Rp 7.000/kg = Rp 24.500).",
          "4. Cetak struk dengan detail berat, harga per kg, dan total.",
          "5. Pelanggan bayar + struk sebagai bukti serah terima.",
        ],
      },
      {
        heading: "Tips Optimasi Profit Kiloan",
        body: [
          "1. Set harga per kg yang kompetitif (cek kompetitor di area Anda). Umumnya Rp 5.000 - Rp 8.000/kg untuk cuci setrika.",
          "2. Tawarkan paket membership: 10 kg Rp 60.000 (lebih murah per kg tapi lock-in pelanggan).",
          "3. Tambahkan layanan satuan untuk item khusus (sepatu, bed cover, jas) — margin lebih tinggi.",
          "4. Pantau berat rata-rata per pelanggan — jika < 2 kg, pertimbangkan minimum charge.",
        ],
      },
      {
        heading: "Otomatisasi dengan hivePOS",
        body: [
          "hivePOS mengotomatiskan seluruh proses kiloan: input berat → harga otomatis → struk thermal → laporan harian. Staf tinggal timbang dan input berat, sisanya ditangani sistem.",
          "Laporan otomatis menunjukkan: total kg per hari, rata-rata per pelanggan, pendapatan per kg, dan tren mingguan.",
        ],
      },
      {
        heading: "Kesimpulan",
        body: [
          "Sistem kasir kiloan yang otomatis menghemat waktu staf dan mengurangi kesalahan hitung. Dengan hivePOS, semua perhitungan kiloan, struk, dan laporan jadi otomatis.",
          "Coba gratis untuk 1 outlet di hivepos.id.",
        ],
      },
    ],
  },
  {
    slug: "hivepos-vs-moka-pos-laundry",
    title: "hivePOS vs Moka POS untuk Bisnis Laundry: Perbandingan Lengkap",
    description:
      "hivePOS vs Moka POS: mana yang lebih baik untuk bisnis laundry? Perbandingan harga, fitur laundry, WhatsApp, multi-outlet, dan kemudahan pakai.",
    keywords: "hivepos vs moka pos, alternatif moka pos laundry, perbandingan aplikasi kasir laundry",
    publishedAt: "2026-06-29",
    readTime: "5 menit",
    sections: [
      {
        heading: "Mengapa Membandingkan hivePOS dan Moka POS?",
        body: [
          "Moka POS adalah salah satu aplikasi kasir paling populer di Indonesia. Namun, untuk bisnis laundry specifically, ada alternatif yang lebih cocok dan terjangkau.",
          "Berikut perbandingan jujur hivePOS vs Moka POS untuk bisnis laundry.",
        ],
      },
      {
        heading: "Harga",
        body: [
          "Moka POS: mulai ~Rp 169.000/bulan per outlet. Ada biaya tambahan untuk modul tertentu.",
          "hivePOS: gratis untuk 1 outlet, Rp 49.000/outlet untuk multi-outlet. Semua fitur laundry termasuk.",
          "Untuk laundry kecil-menengah, hivePOS 3x lebih murah dari Moka POS.",
        ],
      },
      {
        heading: "Fitur Spesifik Laundry",
        body: [
          "Moka POS adalah general POS — fitur laundry (kiloan, satuan, estimasi waktu) perlu konfigurasi manual atau add-on.",
          "hivePOS dirancang khusus untuk laundry: sistem kiloan built-in, layanan satuan, membership, paket bulanan, dan estimasi waktu selesai otomatis.",
        ],
      },
      {
        heading: "WhatsApp Order",
        body: [
          "Moka POS: integrasi WhatsApp via add-on/third-party, biasanya berbayar tambahan.",
          "hivePOS: WhatsApp order built-in, gratis. Setiap chat masuk bisa langsung jadi order di sistem.",
        ],
      },
      {
        heading: "Multi-Outlet",
        body: [
          "Moka POS: mendukung multi-outlet tapi setiap outlet = 1 subscription penuh (~Rp 169K/outlet).",
          "hivePOS: multi-outlet mulai Rp 49K/outlet tambahan. Dashboard terpusat untuk semua cabang.",
        ],
      },
      {
        heading: "Instalasi dan Akses",
        body: [
          "Moka POS: aplikasi desktop/tablet yang perlu diinstal. Update manual.",
          "hivePOS: 100% browser-based. Jalan di HP, tablet, laptop — tanpa instalasi. Akses dari mana saja.",
        ],
      },
      {
        heading: "Kapan Pilih Moka POS?",
        body: [
          "Moka POS cocok jika Anda menjalankan bisnis retail/F&B yang complex (inventory management, multi-payment, loyalty program advanced). Untuk bisnis yang BUKAN murni laundry.",
        ],
      },
      {
        heading: "Kapan Pilih hivePOS?",
        body: [
          "hivePOS cocok jika bisnis Anda adalah laundry (kiloan/satuan), butuh WhatsApp order, multi-outlet terjangkau, dan ingin browser-based tanpa instalasi.",
          "Coba gratis untuk 1 outlet di hivepos.id — tanpa kartu kredit.",
        ],
      },
    ],
  },
];

// Lightweight card view for the homepage "Artikel Terbaru" section — keeps the
// homepage DB-free while linking every published post (de-orphans the blog for
// crawlers). Derived from BLOG_POSTS so it can't drift from the seed source.
export const BLOG_POST_CARDS = BLOG_POSTS.map((p) => ({
  slug: p.slug,
  title: p.title,
  description: p.description,
}));
