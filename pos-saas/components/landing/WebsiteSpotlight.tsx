import Link from "next/link";
import { ArrowRight, Check, Star } from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";
import { WEBSITE_FEATURES, WEBSITE_FEATURE_GROUPS } from "@/lib/landing-data-saas";

/**
 * Real component preview of the auto-generated tenant website — a mini render
 * of an actual outlet site (slug.hivepos.id), not a div-based fake screenshot.
 * Minimal URL bar (no fake traffic-light chrome) signals "this is a web page".
 */
function StorefrontPreview() {
  const services = [
    { name: "Laundry Kiloan", price: "Rp 7.000/kg" },
    { name: "Express 7 jam", price: "Rp 15.000/kg" },
    { name: "Bedcover", price: "Rp 35.000/pcs" },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-brand" />
        <span className="font-mono text-xs text-slate-500">honeybee.hivepos.id</span>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-base font-extrabold text-slate-900">
            Honey Bee Laundry
          </span>
          <span className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
            Buka Sekarang
          </span>
        </div>
        <p className="mt-2 font-display text-lg font-bold leading-snug text-slate-900">
          Bersih, wangi, tepat waktu.
        </p>
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
            <Star className="h-3.5 w-3.5 fill-brand text-brand" />
            4.9 Google
          </span>
          <span>2 hari proses</span>
          <span>Antar-jemput</span>
        </div>
        <ul className="mt-4 space-y-1.5">
          {services.map((s) => (
            <li
              key={s.name}
              className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-1.5 text-xs"
            >
              <span className="text-slate-600">{s.name}</span>
              <span className="font-bold text-slate-800 tabular-nums">{s.price}</span>
            </li>
          ))}
        </ul>
        <span className="mt-4 block rounded-full bg-brand py-2 text-center text-xs font-bold text-white">
          Pesan via WhatsApp
        </span>
      </div>
    </div>
  );
}

export function WebsiteSpotlight() {
  const featuresByGroup = WEBSITE_FEATURE_GROUPS.map(({ name, icon: GroupIcon }) => ({
    name,
    GroupIcon,
    items: WEBSITE_FEATURES.filter((f) => f.group === name),
  }));

  return (
    <section id="website" className="bg-sky-50 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        {/* Split: text | real storefront preview */}
        <div className="grid items-center gap-10 md:grid-cols-2 md:gap-16">
          <ScrollReveal>
            <p className="text-sm font-bold text-sky-700">Eksklusif Pro</p>
            <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Website laundry sendiri, otomatis.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Tiap outlet dapat situs di{" "}
              <code className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-xs text-slate-700">
                slug.hivepos.id
              </code>
              . Otomatis terisi layanan, harga, jam buka, dan testimoni dari dashboard Anda.
            </p>
            <ul className="mt-5 space-y-2.5 text-sm text-slate-700">
              {[
                "Update harga dan layanan dari dashboard, langsung tersinkron.",
                "Pelanggan lacak pesanan tanpa chat admin.",
                "Google mengindeks alamat, jam buka, dan rating otomatis.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand" strokeWidth={2.5} />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/register"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-bold text-white transition-all hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 active:scale-[0.98]"
            >
              Mulai Gratis
              <ArrowRight className="h-4 w-4" />
            </Link>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <StorefrontPreview />
          </ScrollReveal>
        </div>

        {/* Feature groups — compact, hairline-grouped (no card boxes) */}
        <div className="mt-16 grid gap-x-10 gap-y-10 sm:grid-cols-2">
          {featuresByGroup.map(({ name, GroupIcon, items }) => (
            <ScrollReveal key={name}>
              <div className="border-t border-slate-200 pt-5">
                <div className="flex items-center gap-2">
                  <GroupIcon className="h-4 w-4 text-brand" strokeWidth={1.75} />
                  <h3 className="font-display text-sm font-bold text-slate-500">
                    {name}
                  </h3>
                </div>
                <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {items.map((feature) => (
                    <li key={feature.title} className="text-sm">
                      <span className="font-semibold text-slate-900">{feature.title}</span>
                      <span className="block text-xs leading-relaxed text-slate-500">
                        {feature.desc}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
