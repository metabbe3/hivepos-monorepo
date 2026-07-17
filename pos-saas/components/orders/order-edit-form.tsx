"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Minus, UserPlus, User, X, Search, Clock, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/format";
import {
  PRICING_TYPE_LABELS,
  SERVICE_CATEGORIES,
} from "@/lib/constants";
import { transformServices, filterBaseItems } from "@/lib/service-transformer";
import type { BaseItem } from "@/lib/service-transformer";
import { SpeedModal } from "@/components/pos/speed-modal";
import { GarmentBreakdownEditor } from "@/components/pos/garment-breakdown-editor";
import { apiFetch } from "@/modules/shared";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import type {
  OrderDetail,
  EditService,
  EditCustomer,
  EditLineItem,
} from "./order-types";

interface Props {
  order: OrderDetail;
  onSave: (payload: {
    customerId: string;
    notes?: string;
    receivedAt?: string;
    items: Array<{
      serviceId: string;
      quantity: number;
      weightKg?: number;
      garmentBreakdown?: { name: string; qty: number }[];
    }>;
    discountType?: "PERCENTAGE" | "FIXED";
    discountAmount?: number;
  }) => Promise<void>;
  onCancel: () => void;
}

export function OrderEditForm({ order, onSave, onCancel }: Props) {
  const { t } = useTranslation();

  const [submitting, setSubmitting] = useState(false);
  const [services, setServices] = useState<EditService[]>([]);
  const [customers, setCustomers] = useState<EditCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<EditCustomer | null>(
    null,
  );
  const [custSearch, setCustSearch] = useState("");
  const [showCustResults, setShowCustResults] = useState(false);
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [custForm, setCustForm] = useState({ name: "", phone: "" });
  const [items, setItems] = useState<EditLineItem[]>([]);
  const [notes, setNotes] = useState("");
  const [svcSearch, setSvcSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [showAllServices, setShowAllServices] = useState(false);
  const [discountMode, setDiscountMode] = useState<
    "none" | "percentage" | "fixed"
  >("none");
  const [discountValue, setDiscountValue] = useState("");
  const [speedModalItem, setSpeedModalItem] = useState<BaseItem | null>(null);
  const [speedModalOpen, setSpeedModalOpen] = useState(false);
  const [receivedAt, setReceivedAt] = useState("");
  const [useCustomTime, setUseCustomTime] = useState(false);

  // Initialize from order on mount
  useEffect(() => {
    setSelectedCustomer({
      id: order.customerId,
      name: order.customerName,
      phone: order.customerPhone ?? "",
      balance: order.customerBalance,
    });
    setItems(
      order.orderItems.map((item) => ({
        serviceId: item.serviceId,
        quantity: String(item.quantity),
        weightKg: item.weightKg ? String(item.weightKg) : "",
        garmentBreakdown: item.garmentBreakdown ?? [],
      })),
    );
    setNotes(order.notes ?? "");

    const itemsSubtotal = order.orderItems.reduce(
      (sum, item) => sum + item.subtotal,
      0,
    );
    if (order.discountType === "PERCENTAGE") {
      setDiscountMode("percentage");
      const pct =
        order.discountAmount > 0 && itemsSubtotal > 0
          ? Math.round((order.discountAmount / itemsSubtotal) * 100)
          : 0;
      setDiscountValue(String(pct));
    } else if (order.discountType === "FIXED") {
      setDiscountMode("fixed");
      setDiscountValue(String(Math.round(order.discountAmount)));
    }

    if (order.receivedAt) {
      const d = new Date(order.receivedAt);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      setReceivedAt(local.toISOString().slice(0, 16));
      setUseCustomTime(true);
    }

    Promise.all([
      apiFetch<EditService[]>("/api/services"),
      apiFetch<EditCustomer[]>("/api/customers"),
      apiFetch<unknown[]>("/api/service-groups"),
    ])
      .then(([svcs, custs]) => {
        setServices(svcs.data.filter((s) => s.isActive));
        setCustomers(custs.data);
      })
      .catch(() => {
        // leave edit lists empty on failure
      });
  }, [order]);

  // Close customer dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-customer-search]")) {
        setShowCustResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ponytail: servicesById Map so per-item lookups are O(1) instead of
  // O(n) Array.find. Rebuilt only when services array changes.
  const servicesById = useMemo(() => {
    const m = new Map<string, EditService>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  function getService(id: string) {
    return servicesById.get(id);
  }

  function calcSubtotal(item: EditLineItem) {
    const svc = servicesById.get(item.serviceId);
    if (!svc) return 0;
    return svc.pricingType === "PER_KG"
      ? svc.basePrice * (parseFloat(item.weightKg) || 0)
      : svc.basePrice * (parseFloat(item.quantity) || 0);
  }

  const subtotal = items.reduce((sum, i) => sum + calcSubtotal(i), 0);

  let discountCalculated = 0;
  if (discountMode === "percentage") {
    const pct = parseFloat(discountValue) || 0;
    discountCalculated = (subtotal * Math.min(pct, 100)) / 100;
  } else if (discountMode === "fixed") {
    const fixed = parseFloat(discountValue) || 0;
    discountCalculated = Math.min(fixed, subtotal);
  }
  const total = subtotal - discountCalculated;

  const totalPcs = items.reduce((sum, item) => {
    const svc = servicesById.get(item.serviceId);
    if (!svc) return sum;
    if (svc.pricingType === "PER_ITEM")
      return sum + (parseInt(item.quantity) || 0);
    return sum + (item.garmentBreakdown?.reduce((s, g) => s + g.qty, 0) || 0);
  }, 0);

  const baseItems = useMemo(() => transformServices(services), [services]);

  const filteredCustomers = custSearch
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(custSearch.toLowerCase()) ||
          c.phone.includes(custSearch),
      )
    : customers;

  const addServiceItem = useCallback((serviceId: string) => {
    setItems((prev) => [
      ...prev,
      { serviceId, quantity: "1", weightKg: "", garmentBreakdown: [] },
    ]);
  }, []);

  const updateItem = useCallback(
    (index: number, field: keyof EditLineItem, value: string) => {
      setItems((prev) => {
        const updated = [...prev];
        updated[index] = { ...updated[index], [field]: value };
        return updated;
      });
    },
    [],
  );

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleCreateCustomer = useCallback(
    async (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      try {
        const { data: customer } = await apiFetch<EditCustomer>(
          "/api/customers",
          { method: "POST", body: custForm },
        );
        setCustomers((prev) => [...prev, customer]);
        setSelectedCustomer(customer);
        setCustModalOpen(false);
        setCustForm({ name: "", phone: "" });
        toast.success(t("newOrder.customerCreated"));
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t("newOrder.failedCreateCustomer"),
        );
      }
    },
    [custForm, t],
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCustomer) return;
      if (items.length === 0) {
        toast.error(t("orders.addItem"));
        return;
      }
      setSubmitting(true);
      try {
        await onSave({
          customerId: selectedCustomer.id,
          notes: notes || undefined,
          receivedAt:
            useCustomTime && receivedAt
              ? new Date(receivedAt).toISOString()
              : undefined,
          items: items.map((i) => ({
            serviceId: i.serviceId,
            quantity: parseFloat(i.quantity),
            weightKg: i.weightKg ? parseFloat(i.weightKg) : undefined,
            garmentBreakdown: i.garmentBreakdown?.length
              ? i.garmentBreakdown
              : undefined,
          })),
          discountType:
            discountMode === "none"
              ? undefined
              : discountMode === "percentage"
                ? "PERCENTAGE"
                : "FIXED",
          discountAmount:
            discountMode === "none" ? undefined : parseFloat(discountValue) || 0,
        });
      } finally {
        setSubmitting(false);
      }
    },
    [
      selectedCustomer,
      items,
      notes,
      useCustomTime,
      receivedAt,
      discountMode,
      discountValue,
      t,
      onSave,
    ],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Customer */}
      <Card className="border border-border/40 bg-card shadow-sm rounded-xl overflow-visible">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t("common.customer")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-xl border border-sky-200 bg-sky-50/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-100">
                  <User className="h-4 w-4 text-sky-600" />
                </div>
                <div>
                  <span className="font-medium text-sm">
                    {selectedCustomer.name}
                  </span>
                  <span className="ml-2 text-xs text-muted-foreground">
                    {selectedCustomer.phone}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs text-sky-600 hover:text-sky-700 hover:bg-sky-50"
                  onClick={() => setCustModalOpen(true)}
                >
                  {t("newOrder.changeCustomer")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setSelectedCustomer(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setCustModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 px-4 py-4 text-sm font-medium text-sky-700 transition-all hover:border-sky-400 hover:bg-sky-50"
              >
                <UserPlus className="h-5 w-5" />
                {t("newOrder.addCustomerQuick")}
              </button>
              <div className="relative" data-customer-search>
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 bg-muted/30 border-border/30"
                  placeholder={t("newOrder.searchPlaceholder")}
                  value={custSearch}
                  onChange={(e) => {
                    setCustSearch(e.target.value);
                    setShowCustResults(true);
                  }}
                  onFocus={() => setShowCustResults(true)}
                />
                {showCustResults && filteredCustomers.length > 0 && (
                  <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border/30 bg-popover shadow-md max-h-48 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2.5 text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-accent/60 transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustSearch("");
                          setShowCustResults(false);
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">{c.phone}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showCustResults && custSearch && filteredCustomers.length === 0 && (
                  <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border/30 bg-popover shadow-md p-3">
                    <p className="text-sm text-muted-foreground mb-2">
                      {t("newOrder.noCustomerFound")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setShowCustResults(false);
                        setCustModalOpen(true);
                      }}
                    >
                      <Plus className="mr-1 h-3 w-3" />{" "}
                      {t("newOrder.newCustomer")}
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Service Picker */}
      <Card className="border border-border/40 bg-card shadow-sm rounded-xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold">
            {t("newOrder.addServices")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 bg-muted/30 border-border/30"
              placeholder={t("newOrder.searchServicePlaceholder")}
              value={svcSearch}
              onChange={(e) => {
                setSvcSearch(e.target.value);
                setShowAllServices(false);
              }}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {(() => {
              const tabs: { id: string; label: string; count: number }[] = [
                {
                  id: "all",
                  label: t("serviceCategories.all"),
                  count: filterBaseItems(baseItems, svcSearch, "all").length,
                },
              ];
              for (const cat of SERVICE_CATEGORIES) {
                if (cat.id === "all" || cat.fallback) continue;
                const count = filterBaseItems(
                  baseItems,
                  svcSearch,
                  cat.id,
                ).length;
                if (count > 0)
                  tabs.push({ id: cat.id, label: t(cat.labelKey), count });
              }
              const othersCount = filterBaseItems(
                baseItems,
                svcSearch,
                "others",
              ).length;
              if (othersCount > 0)
                tabs.push({
                  id: "others",
                  label: t("serviceCategories.others"),
                  count: othersCount,
                });
              return tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                    selectedCategory === tab.id
                      ? "bg-background text-foreground shadow-sm border border-border/40"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted border border-transparent"
                  }`}
                  onClick={() => {
                    setSelectedCategory(tab.id);
                    setShowAllServices(false);
                  }}
                >
                  {tab.label}{" "}
                  {tab.count > 0 && <span className="opacity-70">({tab.count})</span>}
                </button>
              ));
            })()}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 overflow-hidden">
            {(() => {
              const filtered = filterBaseItems(
                baseItems,
                svcSearch,
                selectedCategory,
              );
              const displayed = showAllServices
                ? filtered
                : filtered.slice(0, 16);
              return displayed.map((item) => {
                const hasVariants = item.variants.length > 1;
                const priceDisplay =
                  item.priceRange.min === item.priceRange.max
                    ? formatCurrency(item.priceRange.min)
                    : `${formatCurrency(item.priceRange.min)} — ${formatCurrency(item.priceRange.max)}`;
                return (
                  <button
                    key={item.normalizedName}
                    type="button"
                    className={`flex flex-col items-start rounded-xl border border-border/40 p-3 text-left transition-all hover:shadow-md hover:border-border/80 min-w-0 overflow-hidden ${
                      item.pricingType === "PER_KG"
                        ? "hover:bg-amber-50/50 dark:hover:bg-amber-950/20"
                        : "hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
                    }`}
                    onClick={() => {
                      if (hasVariants) {
                        setSpeedModalItem(item);
                        setSpeedModalOpen(true);
                      } else {
                        addServiceItem(item.defaultServiceId);
                      }
                    }}
                  >
                    <div className="flex items-center gap-1.5 w-full mb-1">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] rounded-full shrink-0 ${
                          item.pricingType === "PER_KG"
                            ? "bg-amber-100/80 text-amber-700 hover:bg-amber-100/80"
                            : "bg-orange-100/80 text-orange-700 hover:bg-orange-100/80"
                        }`}
                      >
                        /{t(PRICING_TYPE_LABELS[item.pricingType])}
                      </Badge>
                      {hasVariants && (
                        <Badge
                          variant="secondary"
                          className="text-[10px] rounded-full bg-sky-100/80 text-sky-700 hover:bg-sky-100/80 shrink-0"
                        >
                          {item.variants.length}{" "}
                          {t("pos.selectSpeed").toLowerCase()}
                        </Badge>
                      )}
                    </div>
                    <span className="font-medium text-sm break-words line-clamp-2">
                      {item.baseName}
                    </span>
                    <span className="text-lg font-bold mt-1">{priceDisplay}</span>
                  </button>
                );
              });
            })()}
          </div>
          {(() => {
            const filtered = filterBaseItems(baseItems, svcSearch, selectedCategory);
            if (!showAllServices && filtered.length > 16) {
              return (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed border-border/60 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllServices(true)}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  {t("newOrder.showMoreServices")} ({filtered.length - 16})
                </Button>
              );
            }
            if (showAllServices && filtered.length > 16) {
              return (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full border-dashed border-border/60 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowAllServices(false)}
                >
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
        onClose={() => {
          setSpeedModalOpen(false);
          setSpeedModalItem(null);
        }}
        onSelect={(serviceId) => addServiceItem(serviceId)}
      />

      {/* Cart / Items */}
      {items.length > 0 && (
        <Card className="border border-border/40 bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("newOrder.orderItems")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.map((item, idx) => {
              const svc = getService(item.serviceId);
              const origItem = order.orderItems.find(
                (oi) => oi.serviceId === item.serviceId,
              );
              const displayName = svc?.name ?? origItem?.serviceName ?? "Unknown";
              const pricingType = svc?.pricingType ?? (origItem?.weightKg ? "PER_KG" : "PER_ITEM");
              return (
                <div
                  key={idx}
                  className="flex items-start sm:items-center gap-3 rounded-xl border border-border/40 bg-muted/20 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      {pricingType === "PER_KG" ? (
                        <>
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                            onClick={() => {
                              const val = Math.max(
                                0,
                                (parseFloat(item.weightKg) || 0) - 0.5,
                              );
                              updateItem(
                                idx,
                                "weightKg",
                                val > 0 ? val.toFixed(1) : "",
                              );
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            step="0.1"
                            className="w-18 rounded-lg border border-border/30 px-2 py-1.5 text-sm text-center bg-transparent font-semibold"
                            value={item.weightKg}
                            onChange={(e) =>
                              updateItem(idx, "weightKg", e.target.value)
                            }
                            placeholder="0.0"
                          />
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                            onClick={() => {
                              const val =
                                (parseFloat(item.weightKg) || 0) + 0.5;
                              updateItem(idx, "weightKg", val.toFixed(1));
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-muted-foreground ml-1">
                            {t("newOrder.kg")}
                          </span>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                            onClick={() => {
                              const val = Math.max(
                                1,
                                (parseInt(item.quantity) || 1) - 1,
                              );
                              updateItem(idx, "quantity", String(val));
                            }}
                          >
                            <Minus className="h-4 w-4" />
                          </button>
                          <input
                            type="number"
                            className="w-16 rounded-lg border border-border/30 px-2 py-1.5 text-sm text-center bg-transparent font-semibold"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItem(idx, "quantity", e.target.value)
                            }
                          />
                          <button
                            type="button"
                            className="h-9 w-9 rounded-full border border-border/30 flex items-center justify-center hover:bg-accent/60 transition-colors"
                            onClick={() => {
                              const val = (parseInt(item.quantity) || 0) + 1;
                              updateItem(idx, "quantity", String(val));
                            }}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          <span className="text-xs text-muted-foreground ml-1">
                            {t("orders.items")}
                          </span>
                        </>
                      )}
                    </div>
                    {pricingType === "PER_KG" && (
                      <GarmentBreakdownEditor
                        value={items[idx].garmentBreakdown || []}
                        onChange={(newBreakdown) => {
                          const updated = [...items];
                          updated[idx] = {
                            ...updated[idx],
                            garmentBreakdown: newBreakdown,
                          };
                          setItems(updated);
                        }}
                      />
                    )}
                  </div>
                  <span className="font-bold text-sm whitespace-nowrap mt-1">
                    {formatCurrency(calcSubtotal(item))}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 shrink-0 rounded-full text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}

            {/* Price Breakdown */}
            <div className="space-y-2 rounded-xl bg-gradient-to-r from-primary/8 to-primary/4 dark:from-primary/5 dark:to-primary/3 p-4 mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {t("orderDetails.subtotal")}
                </span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              {discountCalculated > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("orderDetails.discount")}
                    {discountMode === "percentage" && discountValue
                      ? ` (${discountValue}%)`
                      : ""}
                    {discountMode === "fixed"
                      ? ` ${t("orderDetails.fixed")}`
                      : ""}
                  </span>
                  <span className="text-red-600">
                    -{formatCurrency(discountCalculated)}
                  </span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between items-center">
                <span className="font-semibold text-base">
                  {t("common.total")}
                </span>
                <span className="text-2xl font-bold">
                  {formatCurrency(total)}
                </span>
              </div>
              {totalPcs > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>
                    {t("garment.totalItems").replace("{count}", String(totalPcs))}
                  </span>
                  <span />
                </div>
              )}
            </div>

            {!selectedCustomer && (
              <div className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-sky-200 bg-sky-50/50 px-4 py-4 text-sm text-sky-700">
                <UserPlus className="h-4 w-4" />
                <span>{t("newOrder.assignCustomer")}</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Discount */}
      {items.length > 0 && (
        <Card className="border border-border/40 bg-card shadow-sm rounded-xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              {t("newOrder.discount")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  discountMode === "none"
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "border-border/40 hover:bg-muted/30 text-muted-foreground"
                }`}
                onClick={() => {
                  setDiscountMode("none");
                  setDiscountValue("");
                }}
              >
                {t("newOrder.noDiscount")}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  discountMode === "percentage"
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "border-border/40 hover:bg-muted/30 text-muted-foreground"
                }`}
                onClick={() => {
                  setDiscountMode("percentage");
                  setDiscountValue("");
                }}
              >
                {t("newOrder.percentage")}
              </button>
              <button
                type="button"
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-medium transition-all ${
                  discountMode === "fixed"
                    ? "border-border bg-background text-foreground shadow-sm"
                    : "border-border/40 hover:bg-muted/30 text-muted-foreground"
                }`}
                onClick={() => {
                  setDiscountMode("fixed");
                  setDiscountValue("");
                }}
              >
                {t("newOrder.fixedAmount")}
              </button>
            </div>
            {discountMode === "percentage" && (
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("newOrder.discountPercentage")}
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="max-w-full sm:max-w-[120px] bg-muted/30 border-border/30 rounded-lg"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            )}
            {discountMode === "fixed" && (
              <div className="space-y-1">
                <Label className="text-xs">
                  {t("newOrder.discountAmount")}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rp</span>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="max-w-full sm:max-w-[200px] bg-muted/30 border-border/30 rounded-lg"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notes & Save */}
      <Card className="border border-border/40 bg-card shadow-sm rounded-xl">
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => {
                if (useCustomTime) {
                  setUseCustomTime(false);
                  setReceivedAt("");
                } else {
                  setUseCustomTime(true);
                  const now = new Date();
                  const offset = now.getTimezoneOffset();
                  const local = new Date(now.getTime() - offset * 60000);
                  setReceivedAt(local.toISOString().slice(0, 16));
                }
              }}
              className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg border transition-colors ${
                useCustomTime
                  ? "border-primary/40 bg-primary/8 text-primary"
                  : "border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>{t("newOrder.customTime")}</span>
            </button>
            {useCustomTime && (
              <Input
                type="datetime-local"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                className="w-full sm:w-auto sm:min-w-[220px] h-9 text-sm bg-muted/30 border-border/60 rounded-lg"
              />
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("common.notes")}</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("newOrder.anyNotes")}
              className="bg-muted/30 border-border/30 rounded-xl"
            />
          </div>
          <Button
            type="submit"
            className="w-full rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105 text-white font-semibold"
            size="lg"
            disabled={submitting || !selectedCustomer || items.length === 0}
          >
            {submitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {t("orders.saveChanges")} — {formatCurrency(total)}
          </Button>
        </CardContent>
      </Card>

      {/* Customer Quick-Add Modal */}
      <Dialog open={custModalOpen} onOpenChange={setCustModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-sky-600" />
              {t("newOrder.newCustomer")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateCustomer} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("common.name")}</Label>
              <Input
                placeholder={t("newOrder.namePlaceholder")}
                value={custForm.name}
                onChange={(e) =>
                  setCustForm({ ...custForm, name: e.target.value })
                }
                className="bg-muted/30 border-border/30"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>{t("common.phone")}</Label>
              <Input
                placeholder={t("newOrder.phonePlaceholder")}
                value={custForm.phone}
                onChange={(e) =>
                  setCustForm({ ...custForm, phone: e.target.value })
                }
                className="bg-muted/30 border-border/30"
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="w-full bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105 text-white font-semibold"
                disabled={!custForm.name || !custForm.phone}
              >
                {t("newOrder.createAndSelect")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </form>
  );
}
