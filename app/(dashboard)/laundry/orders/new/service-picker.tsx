"use client";

import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { PRICING_TYPE_LABELS, SERVICE_CATEGORIES } from "@/lib/constants";
import { filterBaseItems } from "@/lib/service-transformer";
import type { BaseItem } from "@/lib/service-transformer";
import { SpeedModal } from "@/components/pos/speed-modal";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useNewOrder } from "./new-order-context";

// Speed key → label. Mirrors components/pos/speed-modal.tsx so the inline pills
// use the same wording as the (flag-off) modal.
function speedLabel(speed: string, t: (key: string) => string): string {
  switch (speed) {
    case "reguler": return t("pos.speedReguler");
    case "express24": return t("pos.speedExpress24");
    case "express7": return t("pos.speedExpress7");
    default: return t("pos.selectSpeed");
  }
}

// Turnaround hint shown on hover so kasir know what Reguler / 7h / 24h mean.
function speedHint(speed: string, t: (key: string) => string): string {
  switch (speed) {
    case "reguler": return t("pos.speedRegulerHint");
    case "express24": return t("pos.speedExpress24Hint");
    case "express7": return t("pos.speedExpress7Hint");
    default: return t("pos.selectSpeed");
  }
}

export function ServicePicker() {
  const { baseItems, addServiceItem } = useNewOrder();
  const { t } = useTranslation();
  const orderFlowV2 = useFeatureFlag("orderFlowV2");

  const [svcSearch, setSvcSearch] = useState("");
  const [showAllServices, setShowAllServices] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [speedModalItem, setSpeedModalItem] = useState<BaseItem | null>(null);
  const [speedModalOpen, setSpeedModalOpen] = useState(false);

  return (
    <>
      <Card className="border border-border/40 bg-card shadow-sm rounded-xl">
        <CardHeader><CardTitle className="text-base font-semibold">{t("newOrder.addServices")}</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 bg-muted/30 border-border/30"
              placeholder={t("newOrder.searchServicePlaceholder")}
              value={svcSearch}
              onChange={(e) => { setSvcSearch(e.target.value); setShowAllServices(false); }}
            />
          </div>
          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(() => {
              const tabs: { id: string; label: string; count: number }[] = [
                { id: "all", label: t("serviceCategories.all"), count: filterBaseItems(baseItems, svcSearch, "all").length },
              ];
              for (const cat of SERVICE_CATEGORIES) {
                if (cat.id === "all" || cat.fallback) continue;
                const count = filterBaseItems(baseItems, svcSearch, cat.id).length;
                if (count > 0) tabs.push({ id: cat.id, label: t(cat.labelKey), count });
              }
              const othersCount = filterBaseItems(baseItems, svcSearch, "others").length;
              if (othersCount > 0) tabs.push({ id: "others", label: t("serviceCategories.others"), count: othersCount });
              return tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                    selectedCategory === tab.id
                      ? "bg-background text-foreground shadow-sm border border-border/40"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted border border-transparent"
                  }`}
                  onClick={() => { setSelectedCategory(tab.id); setShowAllServices(false); }}
                >
                  {tab.label} {tab.count > 0 && <span className="opacity-70">({tab.count})</span>}
                </button>
              ));
            })()}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-hidden">
            {(() => {
              const filtered = filterBaseItems(baseItems, svcSearch, selectedCategory);
              const displayed = showAllServices ? filtered : filtered.slice(0, 16);
              return displayed.map((item) => {
                const hasVariants = item.variants.length > 1;
                const useInlineSpeeds = orderFlowV2 && hasVariants;
                const priceDisplay = item.priceRange.min === item.priceRange.max
                  ? formatCurrency(item.priceRange.min)
                  : `${formatCurrency(item.priceRange.min)} — ${formatCurrency(item.priceRange.max)}`;

                return (
                  <div
                    key={item.normalizedName}
                    role={useInlineSpeeds ? "group" : "button"}
                    aria-label={useInlineSpeeds ? item.baseName : undefined}
                    tabIndex={useInlineSpeeds ? undefined : 0}
                    className={`group flex flex-col items-start rounded-xl border border-border/40 p-3 text-left transition-all min-w-0 overflow-hidden ${
                      useInlineSpeeds
                        ? ""
                        : `cursor-pointer hover:shadow-md hover:border-border/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            item.pricingType === "PER_KG"
                              ? "hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                              : "hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                          }`
                    }`}
                    onClick={
                      useInlineSpeeds
                        ? undefined
                        : () => {
                            // Single click adds the default variant. The inline pills
                            // below replace this for multi-variant services (orderFlowV2);
                            // flag-off + multi-variant still opens the modal.
                            if (orderFlowV2 || !hasVariants) addServiceItem(item.defaultServiceId);
                            else { setSpeedModalItem(item); setSpeedModalOpen(true); }
                          }
                    }
                    onKeyDown={
                      useInlineSpeeds
                        ? undefined
                        : (e) => {
                            if (e.key !== "Enter" && e.key !== " ") return;
                            e.preventDefault();
                            if (orderFlowV2 || !hasVariants) addServiceItem(item.defaultServiceId);
                            else { setSpeedModalItem(item); setSpeedModalOpen(true); }
                          }
                    }
                  >
                    <div className="flex items-center gap-1.5 w-full mb-1">
                      <Badge variant="secondary" className={`text-[10px] rounded-full shrink-0 ${
                        item.pricingType === "PER_KG"
                          ? "bg-amber-100/80 text-amber-700 hover:bg-amber-100/80"
                          : "bg-orange-100/80 text-orange-700 hover:bg-orange-100/80"
                      }`}>
                        /{t(PRICING_TYPE_LABELS[item.pricingType])}
                      </Badge>
                      {!useInlineSpeeds && hasVariants && (
                        <button
                          type="button"
                          title={t("pos.selectSpeed")}
                          onClick={(e) => { e.stopPropagation(); setSpeedModalItem(item); setSpeedModalOpen(true); }}
                          className="text-[10px] rounded-full bg-sky-100/80 text-sky-700 hover:bg-sky-200/80 hover:text-sky-800 shrink-0 px-2 py-0.5 font-medium transition-colors"
                        >
                          {item.variants.length} {t("pos.selectSpeed").toLowerCase()}
                        </button>
                      )}
                    </div>
                    <span className="font-medium text-sm break-words line-clamp-2">{item.baseName}</span>
                    {useInlineSpeeds ? (
                      <div className="mt-2 flex w-full flex-wrap gap-1.5">
                        {item.variants.map((variant) => (
                          <Tooltip key={variant.serviceId}>
                            <TooltipTrigger
                              render={
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); addServiceItem(variant.serviceId); }}
                                  className={`flex min-w-[5.5rem] flex-1 items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
                                    variant.speed === "reguler"
                                      ? "border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 hover:bg-emerald-100/70 dark:border-emerald-900 dark:bg-emerald-950/30"
                                      : "border-amber-200 bg-amber-50/60 hover:border-amber-400 hover:bg-amber-100/70 dark:border-amber-900 dark:bg-amber-950/30"
                                  }`}
                                />
                              }
                            >
                              <span className="text-xs font-semibold">{speedLabel(variant.speed, t)}</span>
                              <span className="text-xs text-muted-foreground">{formatCurrency(variant.basePrice)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{speedHint(variant.speed, t)}</TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    ) : (
                      <span className="text-lg font-bold mt-1">{priceDisplay}</span>
                    )}
                  </div>
                );
              });
            })()}
          </div>
          {(() => {
            const filtered = filterBaseItems(baseItems, svcSearch, selectedCategory);
            if (!showAllServices && filtered.length > 16) {
              return (
                <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-border/60 text-muted-foreground hover:text-foreground" onClick={() => setShowAllServices(true)}>
                  <Plus className="mr-1 h-3 w-3" />
                  {t("newOrder.showMoreServices")} ({filtered.length - 16})
                </Button>
              );
            }
            if (showAllServices && filtered.length > 16) {
              return (
                <Button type="button" variant="outline" size="sm" className="w-full border-dashed border-border/60 text-muted-foreground hover:text-foreground" onClick={() => setShowAllServices(false)}>
                  {t("newOrder.showLess")}
                </Button>
              );
            }
            return null;
          })()}
        </CardContent>
      </Card>

      <SpeedModal
        baseItem={speedModalItem}
        open={speedModalOpen}
        onClose={() => { setSpeedModalOpen(false); setSpeedModalItem(null); }}
        onSelect={(serviceId) => addServiceItem(serviceId)}
      />
    </>
  );
}
