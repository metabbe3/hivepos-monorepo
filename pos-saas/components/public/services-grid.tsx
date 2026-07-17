"use client";

import { useState } from "react";
import {
  Shirt,
  Wind,
  WashingMachine,
  Scissors,
  Footprints,
  BedDouble,
  Sparkles,
  Crown,
  Hand,
  Package,
} from "lucide-react";

interface ServiceData {
  name: string;
  description: string | null;
  pricingType: string;
  basePrice: number;
  group: { name: string } | null;
}

interface Category {
  label: string;
  icon: React.ReactNode;
  tagline: string;
  minPrice: number;
  unit: string;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("id-ID").format(price);
}

const CATEGORY_RULES: {
  keywords: string[];
  label: string;
  tagline: string;
  icon: React.ReactNode;
}[] = [
  {
    keywords: ["cuci dan setrika", "cuci setrika"],
    label: "Cuci & Setrika",
    tagline: "Cuci bersih, setrika rapi — tinggal pakai",
    icon: <WashingMachine className="h-6 w-6" />,
  },
  {
    keywords: ["cuci dan lipat", "cuci lipat"],
    label: "Cuci & Lipat",
    tagline: "Cuci bersih, lipat rapi — siap simpan",
    icon: <Shirt className="h-6 w-6" />,
  },
  {
    keywords: ["setrika"],
    label: "Setrika",
    tagline: "Setrika profesional, hasil mulus",
    icon: <Scissors className="h-6 w-6" />,
  },
  {
    keywords: ["keringin saja", "keringkan saja"],
    label: "Keringin Saja",
    tagline: "Cukup keringkan, Anda yang setrika",
    icon: <Wind className="h-6 w-6" />,
  },
];

const ITEM_CATEGORIES: {
  keywords: string[];
  label: string;
  tagline: string;
  icon: React.ReactNode;
}[] = [
  {
    keywords: ["sepatu", "shoe"],
    label: "Cuci Sepatu",
    tagline: "Sepatu bersih seperti baru",
    icon: <Footprints className="h-6 w-6" />,
  },
  {
    keywords: ["selimut", "sprei", "bedcover", "bed cover"],
    label: "Selimut & Sprei",
    tagline: "Bedding bersih dan segar",
    icon: <BedDouble className="h-6 w-6" />,
  },
  {
    keywords: ["jaket", "sweater"],
    label: "Jaket & Sweater",
    tagline: "Jaket tebal bersih maksimal",
    icon: <Sparkles className="h-6 w-6" />,
  },
  {
    keywords: ["karpet"],
    label: "Karpet",
    tagline: "Karpet bersih, rumah segar",
    icon: <Package className="h-6 w-6" />,
  },
  {
    keywords: ["jas", "blazer", "gaun", "dress"],
    label: "Pakaian Formal",
    tagline: "Perawatan premium untuk pakaian penting",
    icon: <Crown className="h-6 w-6" />,
  },
  {
    keywords: ["boneka", "tas kain"],
    label: "Boneka & Tas",
    tagline: "Barang kesayangan tetap bersih",
    icon: <Hand className="h-6 w-6" />,
  },
];

function buildCategories(
  services: ServiceData[],
  type: "kiloan" | "satuan"
): Category[] {
  const categories: Category[] = [];
  const matched = new Set<number>();

  const rules = type === "kiloan" ? CATEGORY_RULES : ITEM_CATEGORIES;

  for (const rule of rules) {
    const matches = services.filter(
      (s, i) =>
        !matched.has(i) &&
        rule.keywords.some((kw) => s.name.toLowerCase().includes(kw))
    );
    if (matches.length === 0) continue;
    matches.forEach((_, idx) => {
      const origIdx = services.indexOf(matches[idx]);
      matched.add(origIdx);
    });

    const cheapest = matches.reduce((a, b) =>
      a.basePrice < b.basePrice ? a : b
    );
    categories.push({
      label: rule.label,
      icon: rule.icon,
      tagline: rule.tagline,
      minPrice: cheapest.basePrice,
      unit: cheapest.pricingType === "PER_KG" ? "/kg" : "/pcs",
    });
  }

  return categories;
}

export function ServicesGrid({ services }: { services: ServiceData[] }) {
  const [activeTab, setActiveTab] = useState<"kiloan" | "satuan">("kiloan");

  const filteredServices = services.filter((s) =>
    activeTab === "kiloan" ? s.pricingType === "PER_KG" : s.pricingType === "PER_ITEM"
  );

  const categories = buildCategories(filteredServices, activeTab);

  return (
    <div>
      {/* Toggle — bold pill design */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center rounded-full bg-white p-1.5 shadow-lg shadow-slate-900/5 border border-slate-100">
          <button
            type="button"
            onClick={() => setActiveTab("kiloan")}
            aria-pressed={activeTab === "kiloan"}
            className={`rounded-full px-8 py-3 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              activeTab === "kiloan"
                ? "bg-gradient-to-r from-brand to-amber-600 text-white shadow-lg shadow-brand/20"
                : "text-slate-500 hover:text-foreground"
            }`}
          >
            Kiloan
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("satuan")}
            aria-pressed={activeTab === "satuan"}
            className={`rounded-full px-8 py-3 text-sm font-bold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
              activeTab === "satuan"
                ? "bg-gradient-to-r from-brand to-amber-600 text-white shadow-lg shadow-brand/20"
                : "text-slate-500 hover:text-foreground"
            }`}
          >
            Satuan
          </button>
        </div>
      </div>

      {/* Grid — bold card design */}
      <div className="mt-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <div
            key={cat.label}
            className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-lg shadow-slate-900/5 transition-all duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-xl hover:shadow-brand/10"
          >
            <div className="h-1 bg-gradient-to-r from-brand to-amber-500" />
            <div className="flex flex-col items-center p-5 sm:p-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand transition-all duration-300 group-hover:bg-brand group-hover:text-white group-hover:shadow-lg group-hover:shadow-brand/25">
                {cat.icon}
              </div>
              <h3 className="mt-4 text-sm font-bold text-foreground">
                {cat.label}
              </h3>
              <p className="mt-1 text-[11px] leading-snug text-slate-400 font-medium line-clamp-2">
                {cat.tagline}
              </p>
              <div className="mt-4 flex items-baseline gap-0.5">
                <span className="text-[10px] font-bold text-slate-400">Mulai</span>
                <span className="ml-1 font-serif text-xl font-extrabold tracking-tight text-foreground">
                  {formatPrice(cat.minPrice)}
                </span>
                <span className="text-xs font-bold text-brand">{cat.unit}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <p className="mt-8 text-center text-sm text-slate-400">
          Belum ada layanan untuk kategori ini.
        </p>
      )}
    </div>
  );
}
