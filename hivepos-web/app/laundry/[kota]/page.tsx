import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch } from "@/modules/shared";
import type { components } from "@/lib/api/types";
import { SITE_URL, SITE_DOMAIN } from "@/lib/site";
import { cityBySlug, matchCity } from "@/lib/laundry-cities";

// force-dynamic: the tenant list is read at request time so new tenants appear without a
// rebuild (the API isn't reachable at build time). Routes are listed in the sitemap.
export const dynamic = "force-dynamic";

type TenantSummary = components["schemas"]["PublicTenantSummary"];

interface PageProps {
  params: Promise<{ kota: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { kota } = await params;
  const city = cityBySlug(kota);
  if (!city) return {};
  return {
    title: `Laundry hivePOS di ${city.name} — Kasir Laundry Online`,
    description: `Direktori usaha laundry ber hivePOS di ${city.name}. Kelola kiloan, satuan, WhatsApp order, dan multi-outlet dari browser. Daftar gratis 1 outlet.`,
    alternates: { canonical: `/laundry/${city.slug}` },
    openGraph: {
      title: `Laundry hivePOS di ${city.name}`,
      description: `Usaha laundry di ${city.name} yang menggunakan hivePOS — kasir laundry di browser.`,
      url: `${SITE_URL}/laundry/${city.slug}`,
      type: "website",
      locale: "id_ID",
    },
  };
}

export default async function LaundryCityPage({ params }: PageProps) {
  const { kota } = await params;
  const city = cityBySlug(kota);
  if (!city) notFound();

  let tenants: TenantSummary[] = [];
  try {
    const { data } = await apiFetch<TenantSummary[]>("/api/public/tenants");
    tenants = (Array.isArray(data) ? data : []).filter(
      (t) => matchCity(t.address)?.slug === city.slug,
    );
  } catch {
    tenants = [];
  }

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Laundry hivePOS di ${city.name}`,
    itemListElement: tenants.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.name,
      url: `https://${t.slug}.${SITE_DOMAIN}/`,
    })),
  };

  return (
    <main className="px-5 sm:px-8 py-16 sm:py-20 bg-white min-h-screen">
      <script type="application/ld+json">{JSON.stringify(itemListJsonLd)}</script>
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 text-center">
          <h1 className="font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Laundry hivePOS di {city.name}
          </h1>
          <p className="mt-3 text-sm text-slate-500 max-w-xl mx-auto">
            Usaha laundry di {city.name} yang menjalankan kasir laundry hivePOS — kiloan, satuan,
            WhatsApp order, dan struk thermal, semua dari browser.
          </p>
        </header>

        {tenants.length > 0 ? (
          <ul className="grid gap-4 sm:grid-cols-2">
            {tenants.map((t) => (
              <li key={t.slug}>
                <a
                  href={`https://${t.slug}.${SITE_DOMAIN}/`}
                  className="block rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-brand/40 hover:shadow-md"
                >
                  <p className="font-display font-bold text-slate-900">{t.name}</p>
                  {t.address && <p className="mt-1 text-sm text-slate-500 line-clamp-2">{t.address}</p>}
                  <span className="mt-2 inline-block text-xs font-semibold text-brand">Kunjungi website →</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
            <p className="font-display text-lg font-bold text-slate-900">
              Belum ada laundry hivePOS di {city.name}
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
              Jadilah yang pertama di {city.name}. Coba hivePOS gratis untuk outlet pertama Anda.
            </p>
            <Link
              href="/register"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-700"
            >
              Daftar Gratis →
            </Link>
          </div>
        )}

        <footer className="mt-12 text-center text-xs text-slate-400">
          <Link href="/laundry" className="hover:text-brand-700">Direktori semua kota</Link>
          {" · "}
          <Link href="/" className="font-semibold text-brand-700 hover:underline">hivePOS</Link>
        </footer>
      </div>
    </main>
  );
}
