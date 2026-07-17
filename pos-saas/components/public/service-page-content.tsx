import { ScrollReveal } from "@/components/landing/ScrollReveal";

interface ServicePageContentProps {
  title: string;
  subtitle: string;
  description: string;
  features: { icon: React.ReactNode; text: string }[];
  services: { name: string; pricingType: string; basePrice: number }[];
  whatsappLink: string | null;
  ctaText?: string;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID").format(price);
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.611.611l4.458-1.495A11.952 11.952 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.387 0-4.607-.798-6.381-2.147l-.446-.346-3.034 1.017 1.017-3.034-.346-.446A9.935 9.935 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z" />
    </svg>
  );
}

export function ServicePageContent({
  title,
  subtitle,
  description,
  features,
  services,
  whatsappLink,
  ctaText = "Hubungi Kami",
}: ServicePageContentProps) {
  return (
    <>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-light via-white to-white px-5 py-20 sm:px-8 sm:py-28">
        <div
          className="pointer-events-none absolute -right-20 -top-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-brand/10 to-brand/5 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `radial-gradient(circle, var(--color-brand) 1px, transparent 1px)`,
            backgroundSize: "24px 24px",
          }}
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-3xl text-center">
          <ScrollReveal delay={1}>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/80 px-4 py-2 backdrop-blur-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                hivePOS
              </span>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <h1 className="font-serif text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              {title}
            </h1>
          </ScrollReveal>
          <ScrollReveal delay={2}>
            <p className="mt-5 text-lg leading-relaxed text-slate-500 sm:text-xl">
              {subtitle}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-5">
            {features.map((feature, i) => (
              <ScrollReveal key={i} delay={(i % 4) + 1 as 1 | 2 | 3 | 4}>
                <div className="group flex h-full flex-col items-center rounded-2xl border border-brand/10 bg-white p-5 text-center shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-xl hover:shadow-brand/10">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-white">
                    {feature.icon}
                  </div>
                  <p className="mt-4 text-sm font-bold text-foreground">{feature.text}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Description Section */}
      <section className="bg-surface-muted px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto max-w-3xl">
          <ScrollReveal delay={1}>
            <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
              {description}
            </p>
          </ScrollReveal>
        </div>
      </section>

      {/* Pricing Section */}
      {services.length > 0 && (
        <section className="bg-white px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-5xl">
            <ScrollReveal delay={1}>
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-brand">
                  Daftar Harga
                </p>
                <h2 className="mt-2 font-serif text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                  Pilih Layanan Anda
                </h2>
                <p className="mt-3 text-sm text-slate-500">
                  Semua varian layanan tersedia — pilih yang sesuai kebutuhan Anda
                </p>
              </div>
            </ScrollReveal>
            <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
              {services.map((svc, i) => (
                <ScrollReveal key={svc.name} delay={(i % 4) + 1 as 1 | 2 | 3 | 4}>
                  <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-xl hover:shadow-brand/10">
                    <div className="h-1.5 bg-gradient-to-r from-brand to-amber-500" />
                    <div className="flex flex-1 flex-col items-center justify-center p-5 text-center">
                      <h3 className="text-sm font-bold text-foreground">{svc.name}</h3>
                      <div className="mt-3 flex items-baseline gap-0.5">
                        <span className="text-[10px] font-bold text-slate-400">Rp</span>
                        <span className="font-serif text-2xl font-extrabold tracking-tight text-foreground">
                          {formatPrice(svc.basePrice)}
                        </span>
                        <span className="text-xs font-bold text-brand">
                          {svc.pricingType === "PER_KG" ? "/kg" : "/pcs"}
                        </span>
                      </div>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* WhatsApp CTA */}
      {whatsappLink && (
        <section className="bg-surface-muted px-5 py-20 sm:px-8 sm:py-24">
          <ScrollReveal delay={1}>
            <div className="mx-auto max-w-md text-center">
              <h2 className="font-serif text-3xl font-extrabold tracking-tight text-foreground">
                Siap memesan?
              </h2>
              <p className="mt-3 text-sm text-slate-500">
                Hubungi kami via WhatsApp untuk order langsung
              </p>
              <a
                href={whatsappLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-8 inline-flex items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-8 py-4 text-base font-bold text-white shadow-xl shadow-[#25D366]/25 transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#20BD5A] hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2"
              >
                <WhatsAppIcon className="h-5 w-5" />
                {ctaText}
              </a>
            </div>
          </ScrollReveal>
        </section>
      )}
    </>
  );
}
