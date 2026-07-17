import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { ServicesGrid } from "./services-grid";

interface ServiceData {
  name: string;
  description: string | null;
  pricingType: string;
  basePrice: number;
  group: { name: string } | null;
}

export function ServicesSection({ services }: { services: ServiceData[] }) {
  return (
    <section id="layanan" className="relative overflow-hidden bg-surface-muted px-5 py-20 sm:px-8 sm:py-28">
      {/* Decorative blob */}
      <div className="pointer-events-none absolute top-0 left-1/2 h-[400px] w-[800px] -translate-x-1/2 rounded-full bg-brand/5 blur-[120px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <ScrollReveal delay={1}>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/80 px-4 py-2 backdrop-blur-sm">
              <span className="text-xs font-bold uppercase tracking-wider text-brand">
                Layanan Kami
              </span>
            </div>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <h2 className="font-serif text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Harga Murah,
              <br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-brand to-amber-600 bg-clip-text text-transparent"> Hasil Maksimal</span>
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={2}>
            <p className="mx-auto mt-4 max-w-md font-medium text-slate-500">
              Pilih layanan sesuai kebutuhan Anda. Harga mulai <span className="font-bold text-foreground">Rp 3.000/kg</span> dengan garansi kualitas.
            </p>
          </ScrollReveal>
        </div>
        <ScrollReveal delay={2}>
          <ServicesGrid services={services} />
        </ScrollReveal>
      </div>
    </section>
  );
}
