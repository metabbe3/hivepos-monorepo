"use client";

import { useState, useMemo, useCallback } from "react";
import { Plus, Minus, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { renderWhatsAppTemplate } from "@/lib/whatsapp-templates";

interface PriceEstimatorProps {
  services: {
    name: string;
    pricingType: string;
    basePrice: number;
    group: { name: string } | null;
  }[];
  whatsappLink: string | null;
}

interface LineItem {
  serviceIndex: number;
  name: string;
  pricingType: string;
  basePrice: number;
  qty: number;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID").format(price);
}

/** Find the cheapest service matching any of the keyword sets, preferring "Reguler" (no "Express") */
function findCheapest(
  services: PriceEstimatorProps["services"],
  keywords: string[],
  pricingType: string
): number | null {
  const matches = services.filter(
    (s) =>
      s.pricingType === pricingType &&
      keywords.some((kw) => s.name.toLowerCase().includes(kw))
  );
  if (matches.length === 0) return null;

  // Prefer non-Express variants
  const regulars = matches.filter(
    (s) =>
      !s.name.toLowerCase().includes("express") &&
      !s.name.toLowerCase().includes("express")
  );
  const pool = regulars.length > 0 ? regulars : matches;
  const cheapest = pool.reduce((a, b) => (a.basePrice < b.basePrice ? a : b));
  return services.indexOf(cheapest);
}

function getPopularIndices(
  services: PriceEstimatorProps["services"]
): number[] {
  const indices: number[] = [];

  // Cuci & Setrika (PER_KG)
  let idx = findCheapest(services, ["cuci dan setrika", "cuci setrika"], "PER_KG");
  if (idx !== null) indices.push(idx);

  // Cuci & Lipat (PER_KG)
  idx = findCheapest(services, ["cuci dan lipat", "cuci lipat"], "PER_KG");
  if (idx !== null) indices.push(idx);

  // Sepatu (PER_ITEM)
  idx = findCheapest(services, ["sepatu"], "PER_ITEM");
  if (idx !== null) indices.push(idx);

  // Bed Cover / Selimut single (PER_ITEM)
  idx = findCheapest(
    services,
    ["bed cover single", "bedcover single", "selimut single"],
    "PER_ITEM"
  );
  if (idx === null) {
    idx = findCheapest(services, ["bed cover", "bedcover", "selimut"], "PER_ITEM");
  }
  if (idx !== null) indices.push(idx);

  // Jaket (PER_ITEM)
  idx = findCheapest(services, ["jaket tipis", "jaket"], "PER_ITEM");
  if (idx === null) {
    idx = findCheapest(services, ["jaket"], "PER_ITEM");
  }
  if (idx !== null) indices.push(idx);

  // Karpet kecil (PER_ITEM)
  idx = findCheapest(services, ["karpet kecil", "karpet"], "PER_ITEM");
  if (idx === null) {
    idx = findCheapest(services, ["karpet"], "PER_ITEM");
  }
  if (idx !== null) indices.push(idx);

  // Deduplicate
  return Array.from(new Set(indices));
}

export function PriceEstimator({ services, whatsappLink }: PriceEstimatorProps) {
  const [popularExpanded, setPopularExpanded] = useState(true);
  const [extraExpanded, setExtraExpanded] = useState(false);
  const [quantities, setQuantities] = useState<Record<number, number>>({});

  const popularIndices = useMemo(() => getPopularIndices(services), [services]);

  const extraIndices = useMemo(() => {
    const popularSet = new Set(popularIndices);
    return services
      .map((_, i) => i)
      .filter((i) => !popularSet.has(i));
  }, [services, popularIndices]);

  const getQty = useCallback(
    (idx: number): number => quantities[idx] ?? 0,
    [quantities]
  );

  const adjustQty = useCallback(
    (idx: number, delta: number, pricingType: string) => {
      setQuantities((prev) => {
        const current = prev[idx] ?? 0;
        const step = pricingType === "PER_KG" ? 0.5 : 1;
        const next = Math.max(0, current + delta * step);
        // Remove zero entries to keep state clean
        const copy = { ...prev };
        if (next === 0) {
          delete copy[idx];
        } else {
          copy[idx] = next;
        }
        return copy;
      });
    },
    []
  );

  const total = useMemo(() => {
    let sum = 0;
    for (const [idxStr, qty] of Object.entries(quantities)) {
      const idx = Number(idxStr);
      if (idx >= 0 && idx < services.length) {
        sum += qty * services[idx].basePrice;
      }
    }
    return sum;
  }, [quantities, services]);

  const handleWhatsApp = useCallback(() => {
    if (!whatsappLink) return;

    const entries = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .sort(([a], [b]) => Number(a) - Number(b));

    if (entries.length === 0) return;

    const orderLines = entries
      .map(([idxStr, qty]) => {
        const idx = Number(idxStr);
        const svc = services[idx];
        const subtotal = qty * svc.basePrice;
        const unit = svc.pricingType === "PER_KG" ? "kg" : "pcs";
        const qtyDisplay = Number.isInteger(qty) ? qty.toString() : qty.toFixed(1);
        return `- ${svc.name}: ${qtyDisplay} ${unit} (Rp ${formatPrice(subtotal)})`;
      })
      .join("\n");

    const message = renderWhatsAppTemplate("priceEstimator.summary", {
      orderLines,
      total: formatPrice(total),
    });
    const url = `${whatsappLink}${whatsappLink.includes("?") ? "&" : "?"}text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }, [whatsappLink, quantities, services, total]);

  const hasOrderItems = total > 0;

  return (
    <section id="estimasi" className="relative overflow-hidden bg-white px-5 py-20 sm:px-8">
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-brand/5 blur-[120px]"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-lg">
        <div className="text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white/80 px-4 py-2 backdrop-blur-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-brand">
              Kalkulator
            </span>
          </div>
          <h2 className="mt-4 font-serif text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
            Estimasi Harga
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Hitung estimasi biaya laundry Anda
          </p>
        </div>

        <div className="mt-10 rounded-3xl border border-slate-100 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
          {/* Popular items */}
          {popularIndices.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setPopularExpanded(!popularExpanded)}
                className="mb-3 flex w-full items-center justify-between rounded-lg px-2 py-1 text-sm font-bold text-foreground transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
                aria-expanded={popularExpanded}
              >
                <span>Layanan Populer</span>
                {popularExpanded ? (
                  <ChevronUp className="h-4 w-4 text-brand" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                )}
              </button>

              {popularExpanded && (
                <div className="divide-y divide-gray-50">
                  {popularIndices.map((idx) => (
                    <ServiceRow
                      key={idx}
                      name={services[idx].name}
                      pricingType={services[idx].pricingType}
                      basePrice={services[idx].basePrice}
                      qty={getQty(idx)}
                      onIncrement={() =>
                        adjustQty(idx, 1, services[idx].pricingType)
                      }
                      onDecrement={() =>
                        adjustQty(idx, -1, services[idx].pricingType)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Extra services toggle */}
          {extraIndices.length > 0 && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setExtraExpanded(!extraExpanded)}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 transition-colors hover:border-brand/40 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
                aria-expanded={extraExpanded}
              >
                {extraExpanded ? (
                  <>
                    <ChevronUp className="h-4 w-4" />
                    Sembunyikan Layanan Lainnya
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Tambah Layanan Lainnya
                  </>
                )}
              </button>

              {extraExpanded && (
                <div className="mt-3 max-h-72 divide-y divide-gray-50 overflow-y-auto">
                  {extraIndices.map((idx) => (
                    <ServiceRow
                      key={idx}
                      name={services[idx].name}
                      pricingType={services[idx].pricingType}
                      basePrice={services[idx].basePrice}
                      qty={getQty(idx)}
                      onIncrement={() =>
                        adjustQty(idx, 1, services[idx].pricingType)
                      }
                      onDecrement={() =>
                        adjustQty(idx, -1, services[idx].pricingType)
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="my-6 h-px bg-slate-100" />

          {/* Total */}
          <div className="flex items-center justify-between">
            <span className="text-base font-bold text-foreground">
              Estimasi Total
            </span>
            <span className="font-serif text-2xl font-extrabold tracking-tight text-brand">
              Rp {formatPrice(total)}
            </span>
          </div>

          {/* WhatsApp button */}
          <div className="mt-5">
            {whatsappLink ? (
              <button
                type="button"
                onClick={handleWhatsApp}
                disabled={!hasOrderItems}
                className={`w-full rounded-full py-4 text-base font-bold text-white shadow-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 ${
                  hasOrderItems
                    ? "bg-[#25D366] shadow-[#25D366]/25 hover:-translate-y-0.5 hover:bg-[#20BD5A] hover:shadow-xl"
                    : "cursor-not-allowed bg-[#25D366]/50 shadow-none"
                }`}
              >
                <span className="flex items-center justify-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Pesan via WhatsApp
                </span>
              </button>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  disabled
                  className="w-full cursor-not-allowed rounded-full bg-slate-200 py-4 text-base font-bold text-slate-400"
                >
                  <span className="flex items-center justify-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Pesan via WhatsApp
                  </span>
                </button>
                <p className="mt-2 text-center text-xs text-slate-400">
                  Hubungi kami di outlet
                </p>
              </div>
            )}
          </div>

          {/* Disclaimer */}
          <p className="mt-4 text-center text-xs text-slate-400">
            * Harga estimasi, bisa berubah saat penimbangan
          </p>
        </div>
      </div>
    </section>
  );
}

/** Individual service row with stepper */
function ServiceRow({
  name,
  pricingType,
  basePrice,
  qty,
  onIncrement,
  onDecrement,
}: {
  name: string;
  pricingType: string;
  basePrice: number;
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  const subtotal = qty * basePrice;
  const unit = pricingType === "PER_KG" ? "kg" : "pcs";
  const qtyDisplay = Number.isInteger(qty) ? qty.toString() : qty.toFixed(1);

  return (
    <div className="flex items-center justify-between py-3">
      <div className="mr-2 min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{name}</p>
        <p className="text-[11px] text-slate-400">
          Rp {formatPrice(basePrice)}/{unit}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {/* Stepper */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onDecrement}
            aria-label={`Kurangi ${name}`}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-brand transition-colors hover:bg-amber-100 active:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[2.5rem] text-center text-sm font-bold text-foreground tabular-nums">
            {qtyDisplay} {unit}
          </span>
          <button
            type="button"
            onClick={onIncrement}
            aria-label={`Tambah ${name}`}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-brand transition-colors hover:bg-amber-100 active:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Subtotal */}
        <p className="min-w-[5rem] text-right text-sm font-bold text-foreground tabular-nums">
          {subtotal > 0 ? `Rp ${formatPrice(subtotal)}` : "-"}
        </p>
      </div>
    </div>
  );
}
