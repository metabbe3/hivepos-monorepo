"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { createOrderOffline } from "@/lib/offline/offline-order-create";
import { newClientId, shortPendingId } from "@/lib/offline/client-id";
// ponytail: statically imported (not dynamic) so the offline code path works
// even after the network drops — next dev serves dynamic-import chunks via
// HTTP, which fails when the browser context is offline. The db module is
// SSR-safe (indexedDB is only touched inside getDB(), not at module scope).
import { setCachedServices, setCachedCustomers, getCachedServices } from "@/lib/offline/db";
import { saveDraft, loadDraft, clearDraft, isDraftFresh } from "@/lib/form-drafts";
import { transformServices } from "@/lib/service-transformer";
import type { BaseItem } from "@/lib/service-transformer";
import type { GarmentDetail } from "@/components/pos/garment-breakdown-editor";
import { generateFastCashOptions } from "@/lib/fast-cash";
import { useTranslation } from "@/hooks/use-translation";

// ponytail: extraction of `page.tsx` into context + sections. The provider
// owns all state + handlers + effects; section components are presentational
// and consume via useNewOrder(). No behavior change — pure file split.

export interface Service {
  id: string;
  name: string;
  pricingType: "PER_KG" | "PER_ITEM";
  basePrice: number;
  isActive: boolean;
  isDefaultSpeed: boolean;
  groupId: string | null;
  group: { id: string; name: string } | null;
}

export interface ServiceGroup {
  id: string;
  name: string;
  sortOrder: number;
  _count?: { services: number };
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  balance: number;
  // ponytail: set when this customer row was created offline in the new-customer
  // modal. The order submit uses it to know whether to attach the customer
  // via pendingCustomerId (sync later) or via customerId (already server-side).
  pendingClientId?: string;
}

export interface LineItem {
  serviceId: string;
  quantity: string;
  weightKg: string;
  garmentBreakdown: GarmentDetail[];
}

export type DiscountMode = "none" | "percentage" | "fixed";
export type PaymentMethod = "PAY_LATER" | "CASH" | "DEPOSIT" | "QRIS" | "TRANSFER";

export interface FastCashOption {
  amount: number;
  label: string;
  isExact?: boolean;
}

const DRAFT_ROUTE = "/laundry/orders/new";

interface NewOrderContextValue {
  // Source data
  services: Service[];
  setServices: React.Dispatch<React.SetStateAction<Service[]>>;
  serviceGroups: ServiceGroup[];
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  loading: boolean;
  // Customer
  selectedCustomer: Customer | null;
  setSelectedCustomer: (c: Customer | null) => void;
  // Cart
  items: LineItem[];
  setItems: React.Dispatch<React.SetStateAction<LineItem[]>>;
  orderNotes: string;
  setOrderNotes: (s: string) => void;
  // Discount
  discountMode: DiscountMode;
  setDiscountMode: (m: DiscountMode) => void;
  discountValue: string;
  setDiscountValue: (s: string) => void;
  // Payment
  paymentMethod: PaymentMethod;
  setPaymentMethod: (m: PaymentMethod) => void;
  cashReceived: number | null;
  setCashReceived: (n: number | null) => void;
  // Custom time
  useCustomTime: boolean;
  setUseCustomTime: (b: boolean) => void;
  customDateTime: string;
  setCustomDateTime: (s: string) => void;
  // Derived
  baseItems: BaseItem[];
  subtotal: number;
  total: number;
  totalPcs: number;
  changeAmount: number;
  fastCashOptions: FastCashOption[];
  discountCalculated: number;
  // Lookup helpers
  getService: (id: string) => Service | undefined;
  calcSubtotal: (item: LineItem) => number;
  // Cart mutations
  addServiceItem: (serviceId: string) => void;
  updateItem: (index: number, field: keyof LineItem, value: string) => void;
  removeItem: (index: number) => void;
  // Submit
  submitting: boolean;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  // Post-create success (online): the created order, or null while composing.
  createdOrder: { id: string; orderNumber: string } | null;
  resetForNewOrder: () => void;
  // Draft
  showDraftDialog: boolean;
  setShowDraftDialog: (b: boolean) => void;
  resumeDraft: () => void;
  discardDraft: () => void;
}

const NewOrderContext = createContext<NewOrderContextValue | null>(null);

export function useNewOrder(): NewOrderContextValue {
  const ctx = useContext(NewOrderContext);
  if (!ctx) throw new Error("useNewOrder must be used within <NewOrderProvider>");
  return ctx;
}

export function NewOrderProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const online = useOnlineStatus();
  const offlineEnabled = useFeatureFlag("offlineOrderCreate");

  const [services, setServices] = useState<Service[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Draft recovery state
  const [draftChecked, setDraftChecked] = useState(false);
  const [showDraftDialog, setShowDraftDialog] = useState(false);
  const draftDataRef = useRef<unknown>(null);

  // Customer
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  // Cart
  const [items, setItems] = useState<LineItem[]>([]);
  const [orderNotes, setOrderNotes] = useState("");

  // Discount
  const [discountMode, setDiscountMode] = useState<DiscountMode>("none");
  const [discountValue, setDiscountValue] = useState("");

  // Custom time
  const [useCustomTime, setUseCustomTime] = useState(false);
  const [customDateTime, setCustomDateTime] = useState("");

  // Post-create success state (online only). When set, the page renders the
  // success screen with embedded Pro photo capture instead of the form.
  const [createdOrder, setCreatedOrder] = useState<{ id: string; orderNumber: string } | null>(null);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("PAY_LATER");
  const [cashReceived, setCashReceived] = useState<number | null>(null);

  // Initial load — allSettled so a single failed fetch (e.g. a missing
  // permission or one offline resource) doesn't blank the whole order page;
  // each picker loads what it can. Falls back to the offline cache only if all
  // three came back empty.
  useEffect(() => {
    Promise.allSettled([
      apiFetch<Service[]>("/api/services"),
      apiFetch<Customer[]>("/api/customers"),
      apiFetch<ServiceGroup[]>("/api/service-groups"),
    ]).then(async ([svcsR, custsR, groupsR]) => {
      const svcs = svcsR.status === "fulfilled" ? svcsR.value.data : [];
      const custs = custsR.status === "fulfilled" ? custsR.value.data : [];
      const groups = groupsR.status === "fulfilled" ? groupsR.value.data : [];
      const active = svcs.filter((s) => s.isActive);
      setServices(active);
      setCustomers(custs);
      setServiceGroups(groups);
      setLoading(false);
      // ponytail: warm the offline cache while online so the next visit can
      // fall back if the network is down. Best-effort — failures swallowed.
      try {
        await Promise.all([
          setCachedServices(active as unknown as Array<{ id: string; [k: string]: unknown }>),
          setCachedCustomers(custs as unknown as Array<{ id: string; [k: string]: unknown }>),
        ]);
      } catch {
        /* offline cache is best-effort */
      }
      // All empty (offline at mount + nothing cached server-side) → try IDB.
      if (active.length === 0 && custs.length === 0) {
        try {
          const cached = await getCachedServices();
          if (cached.length > 0) setServices(cached as unknown as Service[]);
        } catch {
          /* IDB unavailable */
        }
      }
    });
  }, []);

  // Draft recovery on mount
  useEffect(() => {
    loadDraft(DRAFT_ROUTE).then((draft) => {
      if (!draft || !isDraftFresh(draft.savedAt)) {
        setDraftChecked(true);
        return;
      }
      const d = draft.data as {
        selectedCustomer: Customer | null;
        items: LineItem[];
        orderNotes: string;
      } | null;
      if (!d || (!d.selectedCustomer && d.items.length === 0 && !d.orderNotes.trim())) {
        setDraftChecked(true);
        return;
      }
      draftDataRef.current = d;
      setShowDraftDialog(true);
    });
  }, []);

  // Debounced autosave — 3s after last change
  useEffect(() => {
    if (!draftChecked || submitting) return;
    // ponytail: only save a draft when there are ITEMS or notes — selecting a
    // customer alone (a brief visit) shouldn't trigger the recovery modal on
    // return. This prevents "modal blocks the page on every visit" (P1).
    const dirty = items.length > 0 || orderNotes.trim();
    if (!dirty) return;

    const timer = setTimeout(() => {
      void saveDraft(DRAFT_ROUTE, {
        selectedCustomer,
        items,
        orderNotes,
        discountMode,
        discountValue,
        paymentMethod,
        useCustomTime,
        customDateTime,
      });
    }, 3000);
    return () => clearTimeout(timer);
  }, [draftChecked, submitting, selectedCustomer, items, orderNotes, discountMode, discountValue, paymentMethod, useCustomTime, customDateTime]);

  function resumeDraft() {
    const d = draftDataRef.current as {
      selectedCustomer: Customer | null;
      items: LineItem[];
      orderNotes: string;
      discountMode: DiscountMode;
      discountValue: string;
      paymentMethod: PaymentMethod;
      useCustomTime: boolean;
      customDateTime: string;
    } | null;
    if (d) {
      setSelectedCustomer(d.selectedCustomer);
      setItems(d.items);
      setOrderNotes(d.orderNotes);
      setDiscountMode(d.discountMode);
      setDiscountValue(d.discountValue);
      setPaymentMethod(d.paymentMethod);
      setUseCustomTime(d.useCustomTime);
      setCustomDateTime(d.customDateTime);
    }
    setShowDraftDialog(false);
    setDraftChecked(true);
  }

  function discardDraft() {
    void clearDraft(DRAFT_ROUTE);
    setShowDraftDialog(false);
    setDraftChecked(true);
  }

  const baseItems = useMemo(() => transformServices(services), [services]);

  const servicesById = useMemo(() => {
    const m = new Map<string, Service>();
    for (const s of services) m.set(s.id, s);
    return m;
  }, [services]);

  function getService(id: string) {
    return servicesById.get(id);
  }

  function calcSubtotal(item: LineItem) {
    const svc = servicesById.get(item.serviceId);
    if (!svc) return 0;
    return svc.pricingType === "PER_KG"
      ? svc.basePrice * (parseFloat(item.weightKg) || 0)
      : svc.basePrice * (parseFloat(item.quantity) || 0);
  }

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + calcSubtotal(i), 0),
    [items, servicesById],
  );

  const discountCalculated = useMemo(() => {
    if (discountMode === "percentage") {
      const pct = parseFloat(discountValue) || 0;
      return subtotal * Math.min(pct, 100) / 100;
    }
    if (discountMode === "fixed") {
      const fixed = parseFloat(discountValue) || 0;
      return Math.min(fixed, subtotal);
    }
    return 0;
  }, [discountMode, discountValue, subtotal]);

  const total = subtotal - discountCalculated;

  const totalPcs = useMemo(
    () => items.reduce((sum, item) => {
      const svc = servicesById.get(item.serviceId);
      if (!svc) return sum;
      if (svc.pricingType === "PER_ITEM") {
        return sum + (parseInt(item.quantity) || 0);
      }
      return sum + (item.garmentBreakdown?.reduce((s, g) => s + g.qty, 0) || 0);
    }, 0),
    [items, servicesById],
  );

  const fastCashOptions = useMemo(() => generateFastCashOptions(total), [total]);
  const changeAmount = cashReceived !== null && cashReceived >= total ? cashReceived - total : 0;

  function addServiceItem(serviceId: string) {
    const svc = servicesById.get(serviceId);
    if (!svc) return;
    setItems((prev) => [
      ...prev,
      {
        serviceId,
        quantity: "1",
        weightKg: "",
        garmentBreakdown: [],
      },
    ]);
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) { toast.error(t("orders.selectCustomer")); return; }
    if (items.length === 0) { toast.error(t("orders.addItem")); return; }
    // P0: reject zero-weight/qty items — prevents Rp 0 orders (real money lost).
    for (const item of items) {
      const svc = servicesById.get(item.serviceId);
      if (!svc) continue;
      if (svc.pricingType === "PER_KG" && (!item.weightKg || parseFloat(item.weightKg) <= 0)) {
        toast.error("Berat harus lebih dari 0 untuk layanan kiloan.");
        return;
      }
      if (svc.pricingType !== "PER_KG" && (!item.quantity || parseInt(item.quantity) <= 0)) {
        toast.error("Jumlah harus lebih dari 0.");
        return;
      }
    }
    if (paymentMethod === "DEPOSIT" && (selectedCustomer.balance || 0) < total) {
      toast.error(t("newOrder.insufficientBalance"));
      return;
    }

    // Offline branch — write to IDB, show PENDING stamp, redirect.
    // ponytail: laundry is receive-first-pay-later so we ignore paymentMethod
    // here and let the order sync as PAY_LATER. The kasir collects payment
    // (cash/QRIS) at pickup time when the network is back.
    if (!online) {
      // Flag-gate (non-negotiable #3): when offlineOrderCreate is OFF, never
      // write to IDB — surface a clear disabled message instead.
      if (!offlineEnabled) {
        toast.error(t("offline.createDisabled"));
        return;
      }
      setSubmitting(true);
      try {
        const pricedItems = items.map((i) => {
          const svc = servicesById.get(i.serviceId)!;
          return {
            serviceName: svc.name,
            quantity: parseFloat(i.quantity) || 0,
            weightKg: i.weightKg ? parseFloat(i.weightKg) : null,
            pricePerUnit: svc.basePrice,
            subtotal: calcSubtotal(i),
          };
        });
        const { orderClientId } = await createOrderOffline({
          existingCustomerId: selectedCustomer.pendingClientId ? undefined : selectedCustomer.id,
          newCustomer: selectedCustomer.pendingClientId
            ? { name: selectedCustomer.name, phone: selectedCustomer.phone || null }
            : undefined,
          items: items.map((i) => ({
            serviceId: i.serviceId,
            quantity: parseFloat(i.quantity),
            weightKg: i.weightKg ? parseFloat(i.weightKg) : undefined,
            garmentBreakdown: i.garmentBreakdown?.length ? i.garmentBreakdown : undefined,
          })),
          notes: orderNotes || undefined,
          discountType: discountMode === "none" ? undefined : discountMode === "percentage" ? "PERCENTAGE" : "FIXED",
          discountAmount: discountMode === "none" ? undefined : parseFloat(discountValue) || 0,
          receivedAt: useCustomTime && customDateTime ? new Date(customDateTime).toISOString() : undefined,
          pricedItems,
          totalAmount: total,
          branchId: "pending", // ponytail: replaced by ctx.branchId at sync time — server resolves from session
          module: "LAUNDRY",
        });
        toast.success(`${t("offline.createdOffline")} — ${shortPendingId(orderClientId)}`);
        void clearDraft(DRAFT_ROUTE);
        router.push("/laundry/orders");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : t("newOrder.failedCreate"));
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setSubmitting(true);
    try {
      const { data: order } = await apiFetch<{ id: string; orderNumber: string }>("/api/orders", {
        method: "POST",
        body: {
          customerId: selectedCustomer.id,
          notes: orderNotes || undefined,
          items: items.map((i) => ({
            serviceId: i.serviceId,
            quantity: parseFloat(i.quantity),
            weightKg: i.weightKg ? parseFloat(i.weightKg) : undefined,
            garmentBreakdown: i.garmentBreakdown?.length ? i.garmentBreakdown : undefined,
          })),
          discountType: discountMode === "none" ? undefined : discountMode === "percentage" ? "PERCENTAGE" : "FIXED",
          discountAmount: discountMode === "none" ? undefined : parseFloat(discountValue) || 0,
          receivedAt: useCustomTime && customDateTime ? new Date(customDateTime).toISOString() : undefined,
        },
      });

      if (paymentMethod !== "PAY_LATER") {
        try {
          await apiFetch(`/api/orders/${order.id}/payments`, {
            method: "POST",
            body: {
              amount: total,
              paymentMethod: paymentMethod as "CASH" | "DEPOSIT" | "QRIS" | "TRANSFER",
            },
          });
        } catch (payErr) {
          toast.warning(payErr instanceof ApiClientError ? payErr.message : t("newOrder.payLaterNote"));
        }
      }

      void clearDraft(DRAFT_ROUTE);
      // Stay on-route: show the success screen (with Pro photo capture)
      // instead of bouncing to the orders list.
      setCreatedOrder({ id: order.id, orderNumber: order.orderNumber });
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("newOrder.failedCreate"));
    } finally {
      setSubmitting(false);
    }
  }

  function resetForNewOrder() {
    setCreatedOrder(null);
    setSelectedCustomer(null);
    setItems([]);
    setOrderNotes("");
    setDiscountMode("none");
    setDiscountValue("");
    setPaymentMethod("PAY_LATER");
    setCashReceived(null);
    // ponytail: keep the last-used custom time so backdating several orders in
    // a row is fast — useCustomTime + customDateTime persist across "new again".
  }

  const value: NewOrderContextValue = {
    services,
    setServices,
    serviceGroups,
    customers,
    setCustomers,
    loading,
    selectedCustomer,
    setSelectedCustomer,
    items,
    setItems,
    orderNotes,
    setOrderNotes,
    discountMode,
    setDiscountMode,
    discountValue,
    setDiscountValue,
    paymentMethod,
    setPaymentMethod,
    cashReceived,
    setCashReceived,
    useCustomTime,
    setUseCustomTime,
    customDateTime,
    setCustomDateTime,
    baseItems,
    subtotal,
    total,
    totalPcs,
    changeAmount,
    fastCashOptions: fastCashOptions as FastCashOption[],
    discountCalculated,
    getService,
    calcSubtotal,
    addServiceItem,
    updateItem,
    removeItem,
    submitting,
    handleSubmit,
    createdOrder,
    resetForNewOrder,
    showDraftDialog,
    setShowDraftDialog,
    resumeDraft,
    discardDraft,
  };

  return <NewOrderContext.Provider value={value}>{children}</NewOrderContext.Provider>;
}
