import { MapPin, Phone, Clock, MessageCircle, ExternalLink, Navigation } from "lucide-react";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

interface BranchData {
  name: string;
  address: string | null;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  operatingHours: Record<string, string> | null;
  whatsappLink: string | null;
  googleMapsLink: string | null;
  [key: string]: unknown;
}

function parseHours(hours: Record<string, string>) {
  return Object.entries(hours).map(([days, time]) => (
    <div key={days} className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
      <span className="text-sm text-slate-500">{days}</span>
      <span className="text-sm font-semibold text-foreground">{String(time)}</span>
    </div>
  ));
}

export function LocationSection({ branches }: { branches: BranchData[] }) {
  const branch = branches[0];
  if (!branch) return null;

  const mapSrc =
    branch.latitude && branch.longitude
      ? `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.755616393449!2d${branch.longitude}!3d${branch.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f5b83a2e5b75%3A0x97f19aa449e30f53!2sKera%20Sakti%20Toko!5e0!3m2!1sen!2sid!4v1779580909387!5m2!1sen!2sid`
      : null;

  return (
    <section id="lokasi" className="relative overflow-hidden px-5 sm:px-8 py-20 sm:py-28 bg-white">
      {/* Decorative */}
      <div className="pointer-events-none absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-brand/5 blur-[100px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-5xl">
        <div className="text-center mb-14">
          <ScrollReveal delay={1}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Lokasi & Jam Operasional</p>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <h2 className="mt-3 font-serif text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Temukan Kami
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={2}>
            <p className="mx-auto mt-3 max-w-md font-medium text-slate-500">
              Kunjungi outlet kami atau hubungi via WhatsApp untuk layanan antar-jemput.
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Map */}
          <ScrollReveal delay={1}>
          <div className="overflow-hidden rounded-3xl bg-slate-100 shadow-2xl shadow-slate-900/5 border border-slate-100 h-full">
            {mapSrc ? (
              <iframe
                src={mapSrc}
                width="100%"
                height="100%"
                style={{ border: 0, minHeight: "320px" }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title="Lokasi"
                className="w-full h-full min-h-[320px]"
              />
            ) : (
              <div className="flex h-80 items-center justify-center">
                <div className="flex flex-col items-center gap-3 text-slate-300">
                  <MapPin className="h-12 w-12" />
                  <span className="text-sm font-medium">Peta Lokasi</span>
                </div>
              </div>
            )}
          </div>
          </ScrollReveal>

          {/* Info card */}
          <ScrollReveal delay={2}>
          <div className="rounded-3xl bg-white border border-slate-100 shadow-2xl shadow-slate-900/5 p-7 sm:p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10">
                <Navigation className="h-5 w-5 text-brand" />
              </div>
              <h3 className="text-lg font-bold text-foreground">{branch.name}</h3>
            </div>

            {branch.address && (
              <div className="flex items-start gap-3 mb-5">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                <p className="text-sm text-slate-500 leading-relaxed">{branch.address}</p>
              </div>
            )}

            {branch.phone && (
              <div className="flex items-center gap-3 mb-5">
                <Phone className="h-4 w-4 shrink-0 text-brand" />
                <a href={`tel:${branch.phone}`} className="text-sm font-medium text-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">
                  {branch.phone}
                </a>
              </div>
            )}

            {branch.operatingHours && typeof branch.operatingHours === "object" && (
              <div className="mb-6">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-brand mb-3">
                  <Clock className="h-4 w-4" />
                  Jam Operasional
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  {parseHours(branch.operatingHours as Record<string, string>)}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              {branch.whatsappLink && (
                <a
                  href={branch.whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#25D366] px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-[#25D366]/25 transition-all hover:-translate-y-0.5 hover:bg-[#20BD5A] hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-4 w-4" />
                  Hubungi via WhatsApp
                </a>
              )}
              {branch.googleMapsLink && (
                <a
                  href={branch.googleMapsLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-foreground transition-all hover:-translate-y-0.5 hover:border-brand/30 hover:text-brand hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  Google Maps
                </a>
              )}
            </div>
          </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
