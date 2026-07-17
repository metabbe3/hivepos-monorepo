"use client";

import { useEffect, useState } from "react";
import { MessageCircle, ArrowRight, Sparkles, Zap, Clock, Truck, ShieldCheck } from "lucide-react";
import { ScrollReveal } from "@/components/landing/ScrollReveal";
import { apiFetch } from "@/modules/shared";

export function HeroSection() {
  const [whatsappUrl, setWhatsappUrl] = useState<string>("#");

  useEffect(() => {
    apiFetch<{ whatsappLink?: string }[]>("/api/public/branches")
      .then((r) => {
        const branches = r.data;
        const link = branches[0]?.whatsappLink;
        if (link) setWhatsappUrl(link);
      })
      .catch(() => {});
  }, []);

  return (
    <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-gradient-to-br from-amber-50 via-white to-white sm:min-h-screen">
      {/* Decorative blobs — amber brand now resolves */}
      <div
        className="pointer-events-none absolute -right-20 -top-40 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-brand/10 to-brand/5 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-brand/10 to-brand/5 blur-3xl"
        aria-hidden="true"
      />

      {/* Dot pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: `radial-gradient(circle, var(--color-brand) 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-5 py-32 sm:px-8 sm:py-0">
        <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12 lg:gap-12">
          {/* Left */}
          <div className="lg:col-span-7">
            <ScrollReveal delay={1}>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/80 px-4 py-2 backdrop-blur-sm">
                <Sparkles className="h-4 w-4 text-brand" />
                <span className="text-xs font-bold uppercase tracking-wider text-brand">
                  Laundry Premium Kemayoran
                </span>
              </div>
            </ScrollReveal>

            <ScrollReveal delay={1}>
              <h1 className="font-serif text-[2.75rem] font-extrabold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
                Pakaian Bersih
                <br />
                <span className="bg-gradient-to-r from-brand via-amber-500 to-amber-600 bg-clip-text text-transparent">
                  Tanpa Repot.
                </span>
              </h1>
            </ScrollReveal>

            <ScrollReveal delay={2}>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-500 sm:text-xl">
                Layanan{" "}
                <span className="font-bold text-foreground">antar-jemput</span>{" "}
                laundry premium di Jakarta Pusat. Selesai dalam 24 jam,{" "}
                <span className="font-bold text-foreground">
                  dijamin bersih &amp; wangi
                </span>
                .
              </p>
            </ScrollReveal>

            <ScrollReveal delay={2}>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:items-center">
                <a
                  href={whatsappUrl}
                  target={whatsappUrl !== "#" ? "_blank" : undefined}
                  rel={whatsappUrl !== "#" ? "noopener noreferrer" : undefined}
                  className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-brand to-amber-600 px-8 py-4 text-base font-bold text-white shadow-xl shadow-brand/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-brand/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <MessageCircle className="h-5 w-5" />
                  Pesan via WhatsApp
                  <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </a>
                <a
                  href="#layanan"
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white px-8 py-4 text-base font-bold text-foreground transition-all duration-300 hover:border-brand/30 hover:text-brand hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  Cek Harga Layanan
                </a>
              </div>
            </ScrollReveal>

            {/* Trust badges */}
            <ScrollReveal delay={3}>
              <div className="mt-10 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white/60 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                    <Zap className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Express 7 Jam
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      Super Cepat
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white/60 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Express 24 Jam
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      Besok Jadi
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white/60 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                    <Truck className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      Antar-Jemput
                    </p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      Area Kemayoran
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white/60 px-4 py-2.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-100">
                    <ShieldCheck className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Garansi</p>
                    <p className="text-[10px] font-semibold text-slate-400">
                      Cuci Ulang Gratis
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </div>

          {/* Right: Price card */}
          <div className="hidden lg:col-span-5 lg:block">
            <ScrollReveal delay={3}>
              <div className="relative animate-float">
                <div className="rounded-3xl border border-slate-100 bg-white p-8 shadow-2xl shadow-slate-900/5">
                  {/* Browser chrome */}
                  <div className="mb-6 flex items-center gap-3">
                    <div className="h-3 w-3 rounded-full bg-red-400" />
                    <div className="h-3 w-3 rounded-full bg-yellow-400" />
                    <div className="h-3 w-3 rounded-full bg-green-400" />
                  </div>

                  <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                    Mulai dari
                  </p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-sm font-bold text-slate-500">Rp</span>
                    <span className="font-serif text-6xl font-extrabold tracking-tight text-foreground">
                      3.000
                    </span>
                    <span className="text-lg font-bold text-slate-400">/kg</span>
                  </div>

                  {/* Speed tiers */}
                  <div className="mt-6 space-y-2.5">
                    <div className="flex items-center justify-between rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 transition-colors hover:bg-amber-100">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-600" />
                        <span className="text-sm font-bold text-amber-800">
                          Express 7 Jam
                        </span>
                      </div>
                      <span className="text-sm font-bold text-amber-700">
                        Rp 8.500/kg
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 transition-colors hover:bg-blue-100">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-bold text-blue-800">
                          Express 24 Jam
                        </span>
                      </div>
                      <span className="text-sm font-bold text-blue-700">
                        Rp 7.500/kg
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 transition-colors hover:bg-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-700">
                          Reguler
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-600">
                        Rp 5.500/kg
                      </span>
                    </div>
                  </div>

                  {/* Inclusions */}
                  <div className="mt-5 space-y-2.5">
                    {[
                      "Cuci & Setrika kiloan",
                      "Cuci sepatu & bedcover",
                      "Antar-jemput area Kemayoran",
                      "Garansi cucian ulang gratis",
                    ].map((item) => (
                      <div
                        key={item}
                        className="flex items-center gap-3 text-sm text-slate-600"
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand/10">
                          <svg
                            className="h-3 w-3 text-brand"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={3}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </span>
                        <span className="font-semibold">{item}</span>
                      </div>
                    ))}
                  </div>

                  <a
                    href={whatsappUrl}
                    target={whatsappUrl !== "#" ? "_blank" : undefined}
                    rel={whatsappUrl !== "#" ? "noopener noreferrer" : undefined}
                    className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-brand to-amber-600 py-4 text-sm font-bold text-white shadow-lg shadow-brand/20 transition-all hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Pesan Sekarang
                  </a>
                </div>

                {/* Floating badge */}
                <div className="absolute -right-4 -top-4 rotate-6 rounded-2xl bg-gradient-to-br from-brand to-amber-600 px-5 py-3 text-white shadow-lg shadow-brand/30">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/80">
                    Kepuasan
                  </p>
                  <p className="font-serif text-2xl font-extrabold">98%</p>
                </div>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </div>
    </section>
  );
}
