import { Phone, Sparkles, CheckCircle, ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

const steps = [
  {
    icon: Phone,
    label: "Pesan",
    number: "01",
    desc: "Hubungi kami via WhatsApp — kurir kami akan menjemput cucian kotor Anda di area Kemayoran dan sekitarnya.",
    accent: "from-brand to-amber-500",
  },
  {
    icon: Sparkles,
    label: "Proses",
    number: "02",
    desc: "Kami cuci dengan deterjen premium dan setrika higienis. Hasil bersih, wangi, dan rapi terjamin.",
    accent: "from-amber-500 to-amber-600",
  },
  {
    icon: CheckCircle,
    label: "Selesai",
    number: "03",
    desc: "Pakaian rapi dan wangi diantar kembali ke pintu rumah Anda. Tinggal simpan dan pakai!",
    accent: "from-amber-600 to-brand",
  },
];

export function ProcessFlow() {
  return (
    <section className="relative overflow-hidden bg-surface-muted px-5 py-20 sm:px-8 sm:py-28">
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/5 blur-[120px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <div className="mb-16 text-center">
          <ScrollReveal delay={1}>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-700">
              Cara Kerja
            </p>
          </ScrollReveal>
          <ScrollReveal delay={1}>
            <h2 className="mt-3 font-serif text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Semudah 1-2-3
            </h2>
          </ScrollReveal>
          <ScrollReveal delay={2}>
            <p className="mx-auto mt-3 max-w-md text-slate-500">
              Tidak perlu repot. Kami yang urus semuanya dari awal sampai pakaian Anda kembali bersih.
            </p>
          </ScrollReveal>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:gap-8 lg:grid-cols-3">
          {steps.map((step, i) => (
            <ScrollReveal key={step.label} delay={(i + 1) as 1 | 2 | 3}>
              <div className="group relative">
                {/* Connector line (desktop only) */}
                {i < steps.length - 1 && (
                  <div className="absolute -right-4 top-16 z-10 hidden w-8 lg:block">
                    <ArrowRight className="h-5 w-5 text-brand/30 transition-colors group-hover:text-brand/60" />
                  </div>
                )}

                <div className="relative h-full rounded-3xl border border-slate-100 bg-white p-8 shadow-lg shadow-slate-900/5 transition-all duration-500 hover:-translate-y-2 hover:shadow-xl hover:shadow-brand/5">
                  {/* Step number */}
                  <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${step.accent} font-serif text-lg font-bold text-white shadow-lg`}>
                    {step.number}
                  </div>

                  {/* Icon */}
                  <div className="mt-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 transition-colors group-hover:bg-brand/15">
                    <step.icon className="h-7 w-7 text-brand" />
                  </div>

                  <p className="mt-5 text-xl font-bold text-foreground">
                    {step.label}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {step.desc}
                  </p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
