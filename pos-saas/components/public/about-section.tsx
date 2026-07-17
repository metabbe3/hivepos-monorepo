import { Calendar, Shield, Sparkles, ArrowRight } from "lucide-react";
import { ScrollReveal } from "@/components/landing/ScrollReveal";

const trustCards = [
  {
    icon: Calendar,
    title: "Berpengalaman",
    number: "3+",
    numberLabel: "Tahun",
    description:
      "Melayani ratusan pelanggan di area Kemayoran dan sekitarnya setiap bulan",
  },
  {
    icon: Shield,
    title: "Terpercaya",
    number: "100%",
    numberLabel: "Garansi",
    description:
      "Garansi cucian ulang gratis jika hasil tidak memuaskan — tanpa syarat",
  },
  {
    icon: Sparkles,
    title: "Hasil Terjamin",
    number: "Premium",
    numberLabel: "Kualitas",
    description:
      "Menggunakan produk pembersih berkualitas dan proses standardisasi",
  },
] as const;

export function AboutSection() {
  return (
    <section className="relative overflow-hidden bg-white px-5 py-20 sm:px-8 sm:py-28">
      {/* Decorative gradient */}
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand/5 blur-[100px]" aria-hidden="true" />

      <div className="relative mx-auto max-w-6xl">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left: Headline + text */}
          <div>
            <ScrollReveal delay={1}>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">
                Tentang Kami
              </p>
            </ScrollReveal>
            <ScrollReveal delay={1}>
              <h2 className="mt-3 font-serif text-3xl font-extrabold leading-[1.1] tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Bukan Laundry{" "}
                <span className="bg-gradient-to-r from-brand to-amber-600 bg-clip-text text-transparent">
                  Biasa.
                </span>
              </h2>
            </ScrollReveal>
            <ScrollReveal delay={2}>
              <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
                Berdiri sejak 2024, hivePOS hadir sebagai solusi laundry
                profesional dan terpercaya di Kemayoran, Jakarta Pusat. Melayani
                area Senen, Tanah Tinggi, Gunung Sahari, Galur, Kramat, Cempaka
                Baru, Johar Baru, dan Sawah Besar.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={2}>
              <p className="mt-4 text-base leading-relaxed text-slate-500">
                Kami berkomitmen memberikan hasil cucian bersih, wangi, dan tepat
                waktu dengan harga terjangkau.
              </p>
            </ScrollReveal>
            <ScrollReveal delay={3}>
              <a
                href="#layanan"
                className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-brand transition-all hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded"
              >
                Lihat Layanan Kami
                <ArrowRight className="h-4 w-4" />
              </a>
            </ScrollReveal>
          </div>

          {/* Right: Trust cards in a stacked layout */}
          <div className="space-y-4">
            {trustCards.map((card, i) => (
              <ScrollReveal key={card.title} delay={(i + 1) as 1 | 2 | 3}>
                <div className="group flex items-start gap-5 rounded-2xl border border-slate-100 bg-white p-6 shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-xl">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/10 to-brand/5 text-brand transition-colors group-hover:from-brand group-hover:to-amber-500 group-hover:text-white">
                    <card.icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <p className="text-base font-bold text-foreground">
                        {card.title}
                      </p>
                      <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand">
                        {card.number}
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                      {card.description}
                    </p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
