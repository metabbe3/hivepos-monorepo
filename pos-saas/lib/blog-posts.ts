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
  {
    slug: "cara-memulai-usaha-laundry-kiloan",
    title:
      "Cara Memulai Usaha Laundry Kiloan 2026: Modal, Harga, dan SOP Lengkap",
    description:
      "Panduan lengkap memulai usaha laundry kiloan 2026: modal awal, harga cuci per kg, peralatan minimal, SOP harian, dan tips memilih aplikasi kasir laundry. Buat dari rumah, mulai Rp jutaan.",
    keywords:
      "cara memulai usaha laundry, cara buka usaha laundry kiloan, modal usaha laundry, harga cuci kiloan, tips bisnis laundry, aplikasi kasir laundry",
    publishedAt: "2026-07-22",
    readTime: "8 menit",
    sections: [
      {
        heading: "Kenapa Usaha Laundry Kiloan Masih Menjanjikan di 2026?",
        body: [
          "Bisnis laundry kiloan terus tumbuh karena dua alasan sederhana: orang makin sibuk dan lahan untuk menjemur baju makin sempit, terutama di kos dan apartemen perkotaan. Permintaannya berulang — pelanggan mencuci setiap minggu, bukan sekali beli.",
          "Dengan modal yang relatif kecil dibanding usaha kuliner atau retail, laundry kiloan bisa dimulai dari rumah. Tapi untung atau tidaknya sangat bergantung pada disiplin operasional, harga per kg yang tepat, dan pencatatan yang rapi. Banyak yang gagal bukan karena tidak ada pelanggan, melainkan karena harga salah atau keuangan tidak terkontrol.",
        ],
      },
      {
        heading: "Modal Awal Usaha Laundry Kiloan",
        body: [
          "Modal terbesar adalah mesin. Berikut estimasi modal awal untuk laundry kiloan skala rumahan (kapasitas 8–10 kg per mesin) pada 2026. Angka bersifat indikatif dan bervariasi tergantung merek, kondisi baru/bekas, serta lokasi:",
          "Mesin cuci (1–2 unit, kapasitas 8–10 kg): Rp 2.500.000 – Rp 5.000.000. Mesin pengering atau dryer: Rp 3.000.000 – Rp 5.000.000 (opsional di awal, sangat membantu di musim hujan). Setrika uap + meja setrika: Rp 1.000.000 – Rp 2.000.000. Timbangan digital: Rp 200.000 – Rp 350.000. Rak jemur dan keranjang: Rp 400.000 – Rp 700.000. Stok awal deterjen, pewangi, dan plastik (1 bulan): Rp 500.000 – Rp 1.500.000.",
          "Total modal awal realistis berkisar Rp 8.000.000 – Rp 15.000.000. Anda bisa menekan biaya dengan memakai mesin cuci yang sudah ada di rumah atau membeli peralatan bekas berkualitas. Dryer boleh ditunda dulu jika tempat Anda cukup untuk menjemur.",
        ],
      },
      {
        heading: "Harga Cuci Kiloan dan Estimasi Omzet",
        body: [
          "Kisaran harga cuci kiloan (cuci + setrika) di Indonesia umumnya Rp 5.000 – Rp 7.000 per kg, tergantung kota dan layanan tambahan. Cuci saja (tanpa setrika) biasanya lebih murah, sekitar Rp 4.000 – Rp 5.000 per kg. Layanan express (selesai same-day) lazimnya 1,5–2× harga reguler.",
          "Ilustrasi omzet harian: jika Anda mengelola 30 kg per hari dengan tarif rata-rata Rp 6.000/kg, omzet kotor sekitar Rp 180.000 per hari atau Rp 5,4 juta per bulan. Pada 50 kg/hari, omzet bulanan sekitar Rp 9 juta. Angka ini sebelum dipotong biaya listrik, air, deterjen, dan tenaga kerja.",
          "Kunci profitabilitas bukan di tarif termahal, tapi di volume yang konsisten dan biaya operasional yang terkontrol. Pelanggan tetap (langganan mingguan) jauh lebih bernilai daripada pelanggan sesekali.",
        ],
      },
      {
        heading: "Titik Impas (BEP) dan Cara Menghitungnya",
        body: [
          "Titik impas adalah volume cucian minimum agar pendapatan menutup biaya. Hitung dulu biaya tetap bulanan: cicilan/karyawan, sewa tempat (jika ada), dan penyusutan mesin. Lalu biaya variabel per kg: listrik, air, deterjen, pewangi, dan plastik (umumnya Rp 1.500 – Rp 2.500 per kg).",
          "Jika tarif Anda Rp 6.000/kg dan biaya variabel Rp 2.000/kg, maka margin per kg Rp 4.000. Untuk menutup biaya tetap Rp 2.000.000/bulan, Anda butuh sekitar 500 kg/bulan atau ~17 kg/hari. Di atas angka itu, sisanya jadi laba. Catat angka ini — tanpa perhitungan BEP, Anda bisa merasa sibuk padahal belum untung.",
        ],
      },
      {
        heading: "Peralatan Minimal untuk Memulai",
        body: [
          "Daftar peralatan inti: mesin cuci kapasitas besar, timbangan digital (wajib untuk transparansi harga per kg), setrika uap, meja setrika, rak jemur lipat, keranjang kotor dan bersih terpisah, serta timbangan dapur kecil untuk dosis deterjen.",
          "Jangan lupa perlengkapan pendukung: label/penanda nomor order agar baju tidak tertukar, plastik pembungkus, dan parfum laundry. Penanda nomor order adalah detail kecil yang sangat menentukan kepuasan pelanggan — tertukar baju adalah keluhan nomor satu di industri ini.",
        ],
      },
      {
        heading: "SOP Harian Operasional Laundry",
        body: [
          "Penerapan SOP yang konsisten membedakan laundry yang bertahan dengan yang tutup. Alur standar: terima order → timbang dan catat berat → beri nomor order → pisahkan sesuai jenis kain dan warna → cuci sesuai program → keringkan → setrika → lipat dan rapikan dengan plastik → siap diambil/antar.",
          "Setiap langkah harus tercatat: pelanggan, berat, layanan (kiloan/satuan/express), status, dan waktu selesai. Pencatatan manual di buku cepat berantakan. Itulah kenapa aplikasi kasir laundry yang menangani sistem kiloan menjadi penting — ia otomatis menghitung harga per kg, mencetak struk, dan melacak status order.",
          "Lihat panduan praktis tentang [sistem kasir kiloan](/blog/sistem-kasir-kiloan-cara-kerja) untuk memahami alurnya, atau baca [5 fitur wajib aplikasi kasir laundry](/blog/fitur-wajib-aplikasi-kasir-laundry) sebelum memilih.",
        ],
      },
      {
        heading: "Memilih Aplikasi Kasir Laundry",
        body: [
          "Banyak pemula masih pakai buku atau Excel, lalu kewalahan saat order membludak. Aplikasi kasir laundry yang tepat menghemat waktu dan mengurangi kesalahan hitung. Yang perlu diperhatikan: dukungan harga per kiloan dan satuan dalam satu struk, cetak struk thermal, laporan penjualan harian, dan integrasi WhatsApp untuk konfirmasi order.",
          "Pilih yang ringan dan tidak ribet dipasang — idealnya berjalan di browser sehingga bisa dibuka dari HP, laptop, atau komputer outlet tanpa instalasi. Sebelum memutuskan, baca panduan [cara memilih aplikasi kasir laundry](/blog/cara-memilih-aplikasi-kasir-laundry) agar tidak salah beli.",
        ],
      },
      {
        heading: "Tips Menarik dan Mempertahankan Pelanggan",
        body: [
          "Pelanggan datang karena nyaman, bukan sekadar murah. Berikut yang terbukti efektif: buat paket membership (misal bayar 10kg sekali bayar dapat diskon), tawarkan layanan antar-jemput untuk area dekat, kirim konfirmasi WhatsApp saat cucian diterima dan siap diambil, serta jaga kualitas lipatan dan wangi.",
          "Foto bukti cucian selesai sebelum diantar juga meningkatkan kepercayaan — pelanggan tahu baju mereka ditangani dengan baik. Konsistensi waktu selesai lebih penting daripada janji cepat: kalau bilang 2 hari, pastikan 2 hari.",
        ],
      },
      {
        heading: "Kesalahan Umum yang Wajib Dihindari",
        body: [
          "Beberapa jebakan klasik: menetapkan harga terlalu murah demi bersaing lalu tidak menutup biaya, tidak mencatat order dengan rapi sehingga baju tertukar, mengabaikan biaya listrik dan air yang sebenarnya besar, serta tidak memisahkan uang pribadi dan uang usaha.",
          "Hindari juga membeli peralatan berlebihan di awal. Mulai dengan kapasitas sesuai prediksi pelanggan, lalu naikkan bertahap setelah permintaan terbukti. Modal yang ditahan bisa dipakai untuk modal kerja dan promosi.",
        ],
      },
      {
        heading: "Langkah Pertama Hari Ini",
        body: [
          "Mulailah sederhana: hitung modal yang Anda miliki, survei tarif laundry di area Anda, siapkan peralatan minimal, dan tentukan SOP. Bila masih bingung soal pencatatan, coba aplikasi kasir laundry gratis untuk 1 outlet — Anda bisa langsung mempraktikkan sistem kiloan tanpa biaya.",
          "hivePOS dirancang khusus untuk laundry kiloan dan satuan: browser-native tanpa instalasi, hitung harga per kg otomatis, cetak struk thermal, WhatsApp order, dan laporan penjualan. Daftar gratis dan jalankan outlet pertama Anda hari ini.",
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
