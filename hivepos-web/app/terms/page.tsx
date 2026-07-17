import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Syarat & Ketentuan — hivePOS",
  description: "Syarat & Ketentuan penggunaan hivePOS, termasuk batasan cetak di iOS/iPad dan ketentuan berlangganan.",
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <div className="pub-scope min-h-screen bg-[var(--color-background)]">
      <div className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-primary)] hover:underline mb-8">
          ← Kembali ke Beranda
        </Link>

        <h1 className="font-bold text-3xl tracking-tight mb-2">Syarat & Ketentuan</h1>
        <p className="text-sm text-[var(--color-muted-foreground)] mb-8">
          Terakhir diperbarui: Juni 2026
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-[var(--color-foreground)]">
          {/* Printing */}
          <section>
            <h2 className="font-bold text-lg mb-2">1. Cetak Struk Thermal</h2>
            <p className="mb-2">
              hivePOS mendukung cetak struk thermal melalui 4 metode: Bluetooth, USB (Serial), WiFi/LAN, dan Browser Print.
            </p>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-2">
              <p className="font-semibold text-amber-900 mb-1">⚠️ Batasan di iPhone/iPad (iOS)</p>
              <p className="text-amber-800">
                iOS dan iPadOS (Safari) memblokir akses Bluetooth dan USB dari browser. Di iPhone/iPad, Anda hanya bisa mencetak struk via <strong>WiFi/LAN</strong> (printer yang terhubung jaringan) atau <strong>Browser Print</strong>. Untuk cetak via Bluetooth atau USB, gunakan <strong>Chrome atau Edge</strong> di perangkat Android atau PC/Komputer.
              </p>
            </div>
            <p>
              Kami merekomendasikan menggunakan Android atau PC dengan Chrome/Edge untuk pengalaman cetak yang paling lengkap.
            </p>
          </section>

          {/* Subscription */}
          <section>
            <h2 className="font-bold text-lg mb-2">2. Berlangganan</h2>
            <ul className="space-y-2 pl-5 list-disc">
              <li><strong>Free</strong> — 1 outlet, 2 staff, 100 order/bulan. Gratis selamanya.</li>
              <li><strong>Growth</strong> — Rp 49.000/outlet/bulan. Unlimited outlet, staff, dan order.</li>
              <li><strong>Pro</strong> — Rp 79.000/outlet/bulan. Semua fitur Growth + website laundry + bukti foto order.</li>
            </ul>
            <p className="mt-2">
              Setiap pendaftaran baru mendapat <strong>uji coba Pro gratis 14 hari</strong> dengan semua fitur terbuka. Setelah 14 hari, akun kembali otomatis ke paket Free tanpa biaya. Pembayaran berlangganan dilakukan per outlet dan dapat dihentikan kapan saja.
            </p>
          </section>

          {/* Data Privacy */}
          <section>
            <h2 className="font-bold text-lg mb-2">3. Privasi & Keamanan Data</h2>
            <ul className="space-y-2 pl-5 list-disc">
              <li>Data setiap laundry (tenant) terisolasi — tidak dapat diakses oleh tenant lain.</li>
              <li>Password di-hash menggunakan bcrypt. Kami tidak menyimpan password dalam bentuk teks.</li>
              <li>Foto bukti order otomatis dihapus setelah 7 hari untuk menghemat penyimpanan dan menjaga privasi.</li>
              <li>Kami tidak menjual atau membagikan data pelanggan Anda kepada pihak ketiga.</li>
            </ul>
          </section>

          {/* Acceptable Use */}
          <section>
            <h2 className="font-bold text-lg mb-2">4. Penggunaan yang Wajar</h2>
            <ul className="space-y-2 pl-5 list-disc">
              <li>hivePOS adalah kasir laundry untuk UMKM Indonesia. Penggunaan untuk aktivitas ilegal, spam, atau penyalahgunaan dapat menyebabkan pembekuan akun.</li>
              <li>Anda bertanggung jawab atas keakuratan data yang dimasukkan (harga layanan, data pelanggan, transaksi).</li>
              <li>Setiap tenant hanya boleh memiliki 1 akun. Pembuatan akun ganda untuk menghindari batasan dapat menyebabkan pembekuan.</li>
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="font-bold text-lg mb-2">5. Kontak</h2>
            <p>
              Pertanyaan tentang Syarat & Ketentuan ini? Hubungi kami melalui menu Bantuan di dalam aplikasi, atau email ke support@hivepos.id.
            </p>
          </section>
        </div>

        <div className="mt-12 border-t border-[var(--color-border)] pt-6 text-center">
          <p className="text-xs text-[var(--color-muted-foreground)]">
            Dengan mendaftar, Anda menyetujui Syarat & Ketentuan ini.
          </p>
        </div>
      </div>
    </div>
  );
}
