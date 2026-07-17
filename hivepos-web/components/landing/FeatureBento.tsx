import { ScrollReveal } from "./ScrollReveal";
import { SAAS_FEATURES } from "@/lib/landing-data-saas";

/**
 * Asymmetric bento. Only the two visual-bearing features (chart + receipt)
 * span 2 columns — that tiles 2 wide + 8 narrow into exactly 3 clean rows of 4
 * on md (no empty cells). Rhythm: one dark cell (chart), one tinted cell
 * (receipt), the rest white. Single accent, hairline borders, no gradients.
 */
export function FeatureBento() {
  return (
    <section id="fitur" className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <ScrollReveal className="max-w-2xl">
          <h2 className="font-display text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Semua yang laundry Anda butuhin. Nggak lebih.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Dari kasir harian sampai laporan multi-outlet. Semua sudah termasuk,
            tanpa add-on berbayar.
          </p>
        </ScrollReveal>

        <div className="mt-12 grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {SAAS_FEATURES.map((feature, idx) => {
            const Icon = feature.icon;
            const isWide = feature.visual === "chart" || feature.visual === "receipt";
            const isDark = feature.visual === "chart";

            return (
              <ScrollReveal
                key={feature.title}
                delay={((idx % 3) + 1) as 1 | 2 | 3}
                className={isWide ? "sm:col-span-2" : ""}
              >
                <article
                  className={`flex h-full flex-col p-6 transition-colors ${
                    isDark
                      ? "rounded-xl bg-sky-700 text-white"
                      : feature.visual === "receipt"
                        ? "rounded-xl border border-slate-200 bg-slate-50"
                        : "rounded-xl border border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <Icon
                    className={`h-6 w-6 ${isDark ? "text-white" : "text-brand"}`}
                    strokeWidth={1.75}
                  />
                  <h3
                    className={`mt-4 font-display text-lg font-bold ${
                      isDark ? "text-white" : "text-slate-900"
                    }`}
                  >
                    {feature.title}
                  </h3>
                  <p
                    className={`mt-2 text-sm leading-relaxed ${
                      isDark ? "text-sky-100" : "text-slate-600"
                    }`}
                  >
                    {feature.desc}
                  </p>

                  {feature.visual === "chart" && (
                    <div className="mt-5 flex h-16 items-end gap-1.5">
                      {[40, 65, 45, 80, 55, 90, 70, 100].map((h, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-sm bg-white/80"
                          style={{ height: `${h}%` }}
                        />
                      ))}
                    </div>
                  )}
                  {feature.visual === "receipt" && (
                    <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-white p-3">
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Struk hivePOS</span>
                          <span className="font-mono">#0001</span>
                        </div>
                        {["Kiloan 5kg", "Express 6 jam"].map((row) => (
                          <div key={row} className="flex justify-between text-[11px]">
                            <span className="text-slate-500">{row}</span>
                            <span className="font-bold text-slate-700 tabular-nums">Rp 35.000</span>
                          </div>
                        ))}
                        <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5 text-[11px] font-bold">
                          <span className="text-slate-700">Total</span>
                          <span className="text-brand tabular-nums">Rp 70.000</span>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
