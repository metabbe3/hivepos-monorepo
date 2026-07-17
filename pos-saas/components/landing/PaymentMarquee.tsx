import { SAAS_PAYMENT_METHODS } from "@/lib/landing-data-saas";

/**
 * Branded payment-method chips — each method gets a brand-identity tint so it's
 * instantly recognizable (QRIS red, GoPay green, OVO purple, DANA blue, etc.).
 * Much stronger recognition than gray wordmarks for Indonesian UMKM.
 */
const PAYMENT_STYLES: Record<string, string> = {
  QRIS: "bg-red-50 text-red-700 ring-red-200",
  GoPay: "bg-green-50 text-green-700 ring-green-200",
  OVO: "bg-purple-50 text-purple-700 ring-purple-200",
  DANA: "bg-blue-50 text-blue-700 ring-blue-200",
  ShopeePay: "bg-orange-50 text-orange-700 ring-orange-200",
  BCA: "bg-blue-50 text-blue-700 ring-blue-200",
  Mandiri: "bg-amber-50 text-amber-700 ring-amber-200",
  Cash: "bg-slate-50 text-slate-700 ring-slate-200",
};

export function PaymentMarquee() {
  return (
    <section className="border-b border-slate-200 bg-white py-10">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <p className="text-center text-sm font-bold text-sky-700">
          Pembayaran lokal didukung
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {SAAS_PAYMENT_METHODS.map((method) => (
            <span
              key={method}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ring-1 transition-colors ${
                PAYMENT_STYLES[method] ?? "bg-slate-50 text-slate-700 ring-slate-200"
              }`}
            >
              {method}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
