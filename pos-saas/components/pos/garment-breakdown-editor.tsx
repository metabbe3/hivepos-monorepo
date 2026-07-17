"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@/hooks/use-translation";
import { DEFAULT_GARMENT_CATEGORIES, GARMENT_GROUPS } from "@/lib/constants";
import { ChevronDown, ChevronUp, Plus, Minus, X, Search, Shirt, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

// ponytail: the PER_KG garment picker. Curated categories only (no auto-save —
// that cluttered the list). Grouped under sticky headers for fast scanning.
// Selected chips are solid indigo + check (colorblind-safe dual-coding); the
// whole zone is a light-indigo inset so it reads as a distinct sub-region of
// the cart row, and the collapsed trigger shows a summary of what's in the bag.

export interface GarmentDetail {
  name: string;
  qty: number;
}

interface GarmentBreakdownEditorProps {
  value: GarmentDetail[];
  onChange: (items: GarmentDetail[]) => void;
}

const SUMMARY_PREVIEW = 3;

export function GarmentBreakdownEditor({ value, onChange }: GarmentBreakdownEditorProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(value.length > 0);
  const [customName, setCustomName] = useState("");
  const [qtyInputs, setQtyInputs] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState("");

  const totalCount = value.reduce((sum, g) => sum + g.qty, 0);
  const countFor = (name: string) => value.find((g) => g.name === name)?.qty ?? 0;

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return DEFAULT_GARMENT_CATEGORIES;
    return DEFAULT_GARMENT_CATEGORIES.filter((cat) => {
      const label = t(cat.labelKey).toLowerCase();
      return (
        label.includes(q) ||
        cat.id.toLowerCase().includes(q) ||
        cat.keywords.some((kw) => kw.includes(q))
      );
    });
  }, [searchQuery, t]);

  // When searching, render one flat section (no headers); otherwise group.
  const sections = useMemo(() => {
    if (searchQuery.trim()) return [{ labelKey: null as string | null, items: filtered }];
    return GARMENT_GROUPS.map((g) => ({
      labelKey: g.labelKey,
      items: filtered.filter((c) => c.group === g.id),
    })).filter((s) => s.items.length > 0);
  }, [filtered, searchQuery]);

  const addItem = (name: string) => {
    const existing = value.find((g) => g.name === name);
    if (existing) {
      onChange(value.map((g) => (g.name === name ? { ...g, qty: g.qty + 1 } : g)));
    } else {
      onChange([...value, { name, qty: 1 }]);
      if (!expanded) setExpanded(true);
    }
  };

  const updateQty = (name: string, delta: number) => {
    onChange(
      value
        .map((g) => (g.name === name ? { ...g, qty: Math.max(0, g.qty + delta) } : g))
        .filter((g) => g.qty > 0),
    );
  };

  const setQtyDirect = (name: string, raw: string) => {
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed <= 0) {
      onChange(value.filter((g) => g.name !== name));
    } else {
      onChange(value.map((g) => (g.name === name ? { ...g, qty: parsed } : g)));
    }
  };

  const removeItem = (name: string) => {
    onChange(value.filter((g) => g.name !== name));
  };

  const addCustomItem = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    addItem(trimmed);
    setCustomName("");
  };

  const handleCustomKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addCustomItem();
    }
  };

  const preview = value.slice(0, SUMMARY_PREVIEW);
  const overflow = Math.max(0, value.length - SUMMARY_PREVIEW);

  return (
    <div className="mt-2">
      {/* Collapsed trigger: dashed affordance when empty, indigo summary when populated. */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        aria-expanded={expanded}
        className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
          value.length > 0
            ? "ring-1 ring-primary/30 bg-brand-light/60 text-foreground hover:bg-brand-light dark:bg-brand-light/10"
            : "border border-dashed border-primary/40 bg-brand-light/40 text-primary hover:bg-brand-light dark:bg-brand-light/10"
        }`}
      >
        <Shirt className="h-4 w-4 shrink-0 text-primary" />
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{t("garment.collapse")}</span>
          </>
        ) : value.length > 0 ? (
          <>
            <span className="sr-only">{t("garment.expand")}</span>
            <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
              {preview.map((g) => (
                <span
                  key={g.name}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary sa-tnum"
                >
                  {g.name}<span aria-hidden="true">×{g.qty}</span>
                </span>
              ))}
              {overflow > 0 && (
                <span className="text-xs font-medium text-muted-foreground">
                  {t("garment.moreCount").replace("{n}", String(overflow))}
                </span>
              )}
            </span>
            <span className="ml-auto shrink-0 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold leading-5 text-primary-foreground sa-tnum">
              {totalCount}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
          </>
        ) : (
          <>
            <Plus className="h-4 w-4 shrink-0" />
            <span>{t("garment.expand")}</span>
          </>
        )}
      </button>

      {expanded && (
        <div className="mt-2 animate-in fade-in-0 slide-in-from-bottom-2 space-y-3 rounded-xl border border-primary/20 bg-brand-light/60 p-3 ring-1 ring-primary/10 dark:border-primary/30 dark:bg-brand-light/10">
          {/* Sticky live search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("garment.searchPlaceholder")}
              className="w-full rounded-lg border border-border/60 bg-surface py-2 pl-8 pr-8 text-sm outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/30"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
                aria-label={t("common.clear")}
              >
                <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>

          {/* Grouped, scrollable chip area */}
          <div className="max-h-64 overflow-y-auto scroll-smooth rounded-lg">
            {filtered.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">{t("garment.noMatch")}</p>
            ) : (
              sections.map((section, si) => (
                <div key={si} className={si > 0 ? "mt-1" : ""}>
                  {section.labelKey && (
                    <div className="sticky top-0 z-10 bg-brand-light/80 px-1 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary/70 backdrop-blur-sm dark:bg-brand-light/20">
                      {t(section.labelKey)}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-1.5 p-1 sm:grid-cols-3">
                    {section.items.map((cat) => {
                      const label = t(cat.labelKey);
                      const count = countFor(label);
                      const selected = count > 0;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => addItem(label)}
                          aria-pressed={selected}
                          aria-label={selected ? `${label}, ${count}` : label}
                          className={`flex min-h-[40px] items-center justify-between gap-1.5 rounded-lg px-2.5 text-sm font-medium transition-all active:scale-95 ${
                            selected
                              ? "bg-primary text-primary-foreground ring-1 ring-primary"
                              : "bg-surface text-foreground ring-1 ring-border hover:bg-accent/60"
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-1 truncate">
                            {selected && <Check className="h-3.5 w-3.5 shrink-0" />}
                            <span className="truncate">{label}</span>
                          </span>
                          {selected && (
                            <span className="sa-tnum shrink-0 rounded-full bg-white/25 px-1.5 text-center text-[11px] font-bold leading-5">
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Custom one-off item (de-emphasized fallback) */}
          <div className="flex items-center gap-2">
            <Input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              onKeyDown={handleCustomKeyDown}
              placeholder={t("garment.customName")}
              className="h-9 bg-surface"
            />
            <button
              type="button"
              onClick={addCustomItem}
              disabled={!customName.trim()}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface ring-1 ring-border transition-colors hover:bg-accent/60 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Added items — TERPILIH: precise qty edit / remove */}
          {value.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between px-1 text-[11px] font-semibold uppercase tracking-wide text-primary/70">
                <span>{t("garment.selected")}</span>
                <span className="sa-tnum">{totalCount}</span>
              </div>
              {value.map((g) => (
                <div
                  key={g.name}
                  className="flex items-center gap-2 rounded-lg bg-surface px-3 py-2 ring-1 ring-border"
                >
                  <span className="flex-1 truncate text-sm font-medium">{g.name}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateQty(g.name, -1)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-accent/60"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      value={qtyInputs[g.name] ?? (g.qty === 0 ? "" : String(g.qty))}
                      onChange={(e) => {
                        setQtyInputs({ ...qtyInputs, [g.name]: e.target.value });
                      }}
                      onBlur={() => {
                        const raw = qtyInputs[g.name] ?? String(g.qty);
                        const next = { ...qtyInputs };
                        delete next[g.name];
                        setQtyInputs(next);
                        setQtyDirect(g.name, raw);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      placeholder="0"
                      className="sa-tnum w-16 rounded-lg bg-transparent px-2 py-1.5 text-center text-sm font-semibold outline-none ring-1 ring-border focus:ring-2 focus:ring-primary/30 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => updateQty(g.name, 1)}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-accent/60"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeItem(g.name)}
                      className="ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-primary/15 px-3 pt-2 text-xs">
                <span className="text-muted-foreground">{t("common.total")}</span>
                <span className="sa-tnum font-semibold text-primary">
                  {t("garment.totalItems").replace("{count}", String(totalCount))}
                </span>
              </div>
            </div>
          ) : (
            <p className="py-1 text-xs text-muted-foreground">{t("garment.noDetails")}</p>
          )}
        </div>
      )}
    </div>
  );
}
