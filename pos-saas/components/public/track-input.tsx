"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package } from "lucide-react";

export function TrackInput() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    // ponytail: order-number shape is CODE-YYYYMMDD-XXXX (was ORD-...).
    // Match any prefix so old ORD-* receipts still route to /track/:id.
    if (/^[A-Z]{2,5}-\d{8}-\d{4}$/i.test(trimmed)) {
      router.push(`/track/${trimmed}`);
    } else {
      router.push(`/track?phone=${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <section id="lacak" className="relative px-5 sm:px-8 py-16 sm:py-20 bg-white">
      <div className="mx-auto max-w-2xl">
        <div className={`relative rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-8 sm:p-10 shadow-2xl transition-all duration-300 ${focused ? "ring-2 ring-brand/50 shadow-brand/10" : ""}`}>
          {/* Decorative glow */}
          <div className="pointer-events-none absolute -top-px -right-px -bottom-px -left-px rounded-3xl bg-gradient-to-r from-brand/20 via-transparent to-brand/20 opacity-0 transition-opacity duration-300" style={{ opacity: focused ? 1 : 0 }} />

          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20">
              <Package className="h-5 w-5 text-brand" />
            </div>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold text-brand">
              Lacak Pesanan
            </p>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-bold text-white">
            Di Mana Pakaian Saya?
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Masukkan No. Struk atau No. HP untuk melacak cucian Anda secara real-time.
          </p>

          <form onSubmit={handleSubmit} className="mt-6 flex gap-3">
            <div className="relative flex-1">
              <label htmlFor="track-input" className="sr-only">
                No. Struk atau No. HP
              </label>
              <input
                id="track-input"
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="HBL-20250523-... / 08xx"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm text-white placeholder:text-slate-500 outline-none transition-all focus:border-brand/50 focus:bg-white/10 focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-amber-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/25 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-brand/30 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <Search className="h-4 w-4" />
              <span className="hidden sm:inline">Lacak</span>
            </button>
          </form>

          <div className="mt-4 flex items-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Sistem tracking aktif
            </div>
            <span>•</span>
            <span>Update real-time</span>
          </div>
        </div>
      </div>
    </section>
  );
}
