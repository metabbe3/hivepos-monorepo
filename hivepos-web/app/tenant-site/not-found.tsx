import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Laundry Website Tidak Ditemukan",
  description: "Website laundry ini belum tersedia atau tidak aktif.",
  robots: { index: false, follow: false },
};

// ponytail: notFound() from tenant-site/page.tsx renders this. Same UI as a
// dedicated 404 route without the extra round-trip.
export default function TenantNotFound() {
  return (
    <div className="pub-scope flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center">
      <h1 className="font-display text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
        Website belum tersedia
      </h1>
      <p className="mt-5 max-w-md text-base text-zinc-600">
        Subdomain ini belum memiliki website aktif. Pastikan alamat benar, atau
        hubungi laundry langsung untuk informasi layanan.
      </p>
      <Link
        href="https://hivepos.id"
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:bg-indigo-700"
      >
        Kunjungi hivePOS
      </Link>
    </div>
  );
}
