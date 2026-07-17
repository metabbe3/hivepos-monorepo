"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { flushSync } from "react-dom";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/hooks/use-debounce";
import { useRole } from "@/hooks/use-role";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  Search, ChevronLeft, ChevronRight, Loader2,
  ArrowUpDown, MessageCircle, FileText, Trash2, Pencil,
  Clock, Package, CheckCircle2, Truck, List, Inbox,
  Banknote,
  QrCode,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PendingOrdersSection } from "@/components/orders/pending-orders-section";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { formatCurrency, formatDateTime } from "@/lib/format";
import {
  ORDER_STATUS_CONFIG, ORDER_STATUS_FLOW,
  PAYMENT_STATUS_CONFIG,
} from "@/lib/constants";
import { buildOrderWhatsAppUrl } from "@/lib/whatsapp";
import { useWhatsappTemplates } from "@/hooks/use-whatsapp-templates";
import { toast } from "sonner";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useUrlState } from "@/hooks/use-url-filters";

interface Order {
  id: string;
  orderNumber: string;
  status: "RECEIVED" | "IN_PROGRESS" | "READY" | "DELIVERED";
  totalAmount: number;
  paidAmount: number;
  paymentStatus: "PENDING" | "PARTIAL" | "PAID";
  createdAt: string;
  receivedAt: string | null;
  customerName: string;
  customerPhone: string | null;
}

/** Extended shape from GET /api/orders/:id — needed for WhatsApp message with item details. */
interface OrderDetail extends Order {
  orderItems: {
    serviceName: string;
    weightKg: number | null;
    quantity: number;
    garmentBreakdown: { name: string; qty: number }[] | null;
  }[];
}

function getDateRange(from: string, to: string) {
  const today = new Date();
  // Local-calendar YYYY-MM-DD (NOT toISOString, which shifts to UTC and leaks
  // the previous day into "this month"/"today"). The server reads this as a
  // WIB calendar day via wibDateBounds.
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let dateFrom = "";
  switch (from) {
    case "today":
      dateFrom = fmt(today);
      break;
    case "week":
      dateFrom = fmt(new Date(today.getFullYear(), today.getMonth(), today.getDate() - today.getDay()));
      break;
    case "month":
      dateFrom = fmt(new Date(today.getFullYear(), today.getMonth(), 1));
      break;
  }

  const dateTo = to === "today" ? fmt(today) : "";

  return { dateFrom, dateTo };
}

export default function OrdersPage() {
  const router = useRouter();
  const { isEmployee } = useRole();
  const { can } = usePermissions();
  const { t } = useTranslation();
  const confirm = useConfirm();
  const whatsappTemplates = useWhatsappTemplates();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  // Filters are URL-backed (useUrlState) so they survive list→detail→back, refresh, + share.
  const [search, setSearch] = useUrlState("search", "");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useUrlState("status", "ALL");
  const [pageStr, setPageStr] = useUrlState("page", "1");
  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const [totalPages, setTotalPages] = useState(1);
  const [advancing, setAdvancing] = useState<string | null>(null);

  // Payment dialog
  const [payDialogOpen, setPayDialogOpen] = useState(false);
  const [payOrder, setPayOrder] = useState<Order | null>(null);
  const [payForm, setPayForm] = useState({ amount: "", paymentMethod: "QRIS" as "CASH" | "DEPOSIT" | "QRIS" | "TRANSFER", notes: "", paidAt: new Date().toISOString().slice(0, 10) });
  const orderFlowV2 = useFeatureFlag("orderFlowV2");
  const payFormRef = useRef<HTMLFormElement>(null);
  // orderFlowV2: one-tap "paid exact, via QRIS, now" (amount is pre-filled with the
  // remaining balance when the dialog opens — see openPayDialog).
  const quickPay = () => {
    const remaining = payOrder ? payOrder.totalAmount - payOrder.paidAmount : 0;
    // flushSync commits the form state before submit so handlePayment reads the
    // quick-pay values deterministically (no React-batching race on payment).
    flushSync(() => {
      setPayForm({
        amount: String(remaining),
        paymentMethod: "QRIS",
        notes: "",
        paidAt: new Date().toISOString().slice(0, 10),
      });
    });
    payFormRef.current?.requestSubmit();
  };

  // Filters
  const [sortValue, setSortValue] = useUrlState("sort", "receivedAt_desc");
  const [paymentFilter, setPaymentFilter] = useUrlState("payment", "ALL");
  const [rangeStr, setRangeStr] = useUrlState("range", "0");
  const [customDateFrom, setCustomDateFrom] = useUrlState("from", "");
  const [customDateTo, setCustomDateTo] = useUrlState("to", "");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});

  const NEXT_ACTION: Record<string, { label: string; status: string }> = {
    RECEIVED: { label: t("orders.start"), status: "IN_PROGRESS" },
    IN_PROGRESS: { label: t("orders.ready"), status: "READY" },
    READY: { label: t("orders.deliver"), status: "DELIVERED" },
  };

  const SORT_OPTIONS = [
    { value: "receivedAt_desc", label: t("orders.newestFirst") },
    { value: "receivedAt_asc", label: t("orders.oldestFirst") },
    { value: "totalAmount_desc", label: t("orders.totalHighLow") },
    { value: "totalAmount_asc", label: t("orders.totalLowHigh") },
    { value: "customerName_asc", label: t("orders.customerAZ") },
    { value: "customerName_desc", label: t("orders.customerZA") },
  ];

  const DATE_RANGES = [
    { label: t("dateRange.all"), from: "", to: "" },
    { label: t("dateRange.today"), from: "today", to: "today" },
    { label: t("dateRange.thisWeek"), from: "week", to: "today" },
    { label: t("dateRange.thisMonth"), from: "month", to: "today" },
    { label: t("dateRange.custom"), from: "custom", to: "custom" },
  ];

  const dateRangeIdx = Math.max(0, Math.min(DATE_RANGES.length - 1, parseInt(rangeStr, 10) || 0));

  const [sortBy, sortOrder] = sortValue.split("_") as [string, string];

  const { dateFrom, dateTo } = DATE_RANGES[dateRangeIdx].from === "custom"
    ? { dateFrom: customDateFrom, dateTo: customDateTo }
    : getDateRange(
        DATE_RANGES[dateRangeIdx].from,
        DATE_RANGES[dateRangeIdx].to,
      );

  const fetchOrders = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    params.set("sortBy", sortBy);
    params.set("sortOrder", sortOrder);
    if (!isEmployee && paymentFilter !== "ALL") params.set("paymentStatus", paymentFilter);
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    apiFetch<Order[]>(`/api/orders?${params}`)
      .then((res) => {
        setOrders(res.data || []);
        setTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch(() => {
        setOrders([]);
      })
      .finally(() => setLoading(false));
  }, [status, debouncedSearch, page, sortBy, sortOrder, paymentFilter, dateFrom, dateTo, isEmployee]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Reset page when filters change
  useEffect(() => {
    setPageStr("1");
  }, [status, debouncedSearch, sortValue, paymentFilter, dateRangeIdx, setPageStr]);

  useEffect(() => {
    // P1: include payment + date filters so tab counts match the visible rows.
    const countParams = new URLSearchParams();
    if (paymentFilter !== "ALL") countParams.set("paymentStatus", paymentFilter);
    if (dateFrom) countParams.set("from", dateFrom);
    if (dateTo) countParams.set("to", dateTo);
    const cpQs = countParams.toString();
    const cpSuffix = cpQs ? `&${cpQs}` : "";
    Promise.all([
      apiFetch<unknown[]>(`/api/orders?status=RECEIVED&limit=1${cpSuffix}`),
      apiFetch<unknown[]>(`/api/orders?status=IN_PROGRESS&limit=1${cpSuffix}`),
      apiFetch<unknown[]>(`/api/orders?status=READY&limit=1${cpSuffix}`),
      apiFetch<unknown[]>(`/api/orders?status=DELIVERED&limit=1${cpSuffix}`),
    ]).then(([recv, prog, ready, deliv]) => {
      setStatusCounts({
        RECEIVED: recv.meta?.total ?? 0,
        IN_PROGRESS: prog.meta?.total ?? 0,
        READY: ready.meta?.total ?? 0,
        DELIVERED: deliv.meta?.total ?? 0,
      });
    }).catch(() => {
      // ignore — counts are non-critical
    });
  }, [debouncedSearch, dateFrom, dateTo, paymentFilter]);

  async function advanceStatus(order: Order, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const action = NEXT_ACTION[order.status];
    if (!action) return;

    setAdvancing(order.id);
    try {
      const result = await apiFetch<{ status: Order["status"] }>(`/api/orders/${order.id}/status`, {
        method: "PATCH",
        body: { status: action.status },
      });
      if (status !== "ALL") {
        setOrders((prev) => prev.filter((o) => o.id !== order.id));
      } else {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, status: result.data.status } : o))
        );
      }
      // Keep the status-tab badges honest without a full reload.
      setStatusCounts((prev) => ({
        ...prev,
        [order.status]: Math.max(0, (prev[order.status] ?? 0) - 1),
        [result.data.status]: (prev[result.data.status] ?? 0) + 1,
      }));
      toast.success(`${order.orderNumber} → ${t(ORDER_STATUS_CONFIG[action.status as keyof typeof ORDER_STATUS_CONFIG].labelKey)}`);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("orders.failedUpdate"));
    } finally {
      setAdvancing(null);
    }
  }

  async function deleteOrder(order: Order, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!(await confirm({
      title: t("orders.deleteOrder"),
      description: t("orders.deleteConfirm").replace("{number}", order.orderNumber),
      destructive: true,
    }))) return;
    try {
      await apiFetch(`/api/orders/${order.id}`, { method: "DELETE" });
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      toast.success(t("orders.deleted"));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("orders.failedDelete"));
    }
  }

  async function openWhatsApp(order: Order, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!order.customerPhone) {
      toast.error(t("orders.noPhone"));
      return;
    }
    try {
      const detail = await apiFetch<OrderDetail>(`/api/orders/${order.id}`);
      const url = buildOrderWhatsAppUrl(
        order.customerPhone,
        {
          ...detail.data,
          statusLabelKey: ORDER_STATUS_CONFIG[detail.data.status]?.labelKey ?? detail.data.status,
        },
        t,
        whatsappTemplates,
      );
      window.open(url, "_blank");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("orders.errors.loadDetails"));
    }
  }

  function openPayDialog(order: Order, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const remaining = order.totalAmount - order.paidAmount;
    setPayOrder(order);
    setPayForm({ amount: String(remaining), paymentMethod: "QRIS", notes: "", paidAt: new Date().toISOString().slice(0, 10) });
    setPayDialogOpen(true);
  }

  // ponytail: single source of truth for row action buttons — previously
  // duplicated desktop (hidden sm:flex) + mobile (flex sm:hidden) blocks.
  // variant controls the advance button's ml-auto (mobile only).
  function renderOrderActions(
    order: Order,
    action: { label: string; status: string } | undefined,
    variant: "inline" | "stacked",
  ) {
    return (
      <>
        {/* Pay — inline primary */}
        {!isEmployee && order.paymentStatus !== "PAID" && (
          <button
            type="button"
            aria-label={t("orderDetails.recordPayment")}
            onClick={(e) => openPayDialog(order, e)}
            className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-amber-600 hover:text-amber-700 hover:bg-amber-50/80 transition-colors"
          >
            <Banknote className="h-4 w-4" />
          </button>
        )}
        {/* Advance — inline primary (production line action) */}
        {action && !isEmployee && (
          <Button
            size="sm"
            variant={order.status === "READY" ? "default" : "outline"}
            onClick={(e) => advanceStatus(order, e)}
            disabled={advancing === order.id}
            className={`${variant === "stacked" ? "ml-auto " : ""}shrink-0 rounded-lg`}
          >
            {advancing === order.id && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
            {action.label}
          </Button>
        )}
        {/* Overflow — secondary actions (Edit, WhatsApp, Receipt, Delete) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="More"
                className="inline-flex items-center justify-center h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              />
            }
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {can("orders", "edit") && order.status !== "DELIVERED" && (
              <DropdownMenuItem onClick={() => router.push(`/laundry/orders/${order.id}?edit=true`)}>
                <Pencil className="h-4 w-4 mr-2" /> {t("orders.editOrder")}
              </DropdownMenuItem>
            )}
            {!isEmployee && (
              <DropdownMenuItem onClick={() => openWhatsApp(order, {} as React.MouseEvent)}>
                <MessageCircle className="h-4 w-4 mr-2" /> WhatsApp
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => window.open(`/laundry/orders/${order.id}/receipt`, "_blank")}>
              <FileText className="h-4 w-4 mr-2" /> {t("orders.receipt")}
            </DropdownMenuItem>
            {can("orders", "delete") && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => deleteOrder(order, {} as React.MouseEvent)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" /> {t("orders.deleteOrder")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </>
    );
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payOrder) return;
    const amount = parseFloat(payForm.amount);
    if (!amount || amount <= 0) return;

    setAdvancing(payOrder.id);
    try {
      const result = await apiFetch<{ paymentStatus: Order["paymentStatus"] }>(`/api/orders/${payOrder.id}/payments`, {
        method: "POST",
        body: { amount, paymentMethod: payForm.paymentMethod, notes: payForm.notes || undefined, paidAt: payForm.paidAt || undefined },
      });
      const newPaid = payOrder.paidAmount + amount;
      setOrders((prev) =>
        prev.map((o) =>
          o.id === payOrder.id
            ? { ...o, paidAmount: newPaid, paymentStatus: result.data.paymentStatus ?? "PAID" }
            : o
        )
      );
      toast.success(t("orderDetails.paymentRecorded"));
      setPayDialogOpen(false);
      setPayOrder(null);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("orderDetails.failedRecord"));
    } finally {
      setAdvancing(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("orders.title")} description={t("orders.description")} action={{ label: t("orders.newOrder"), onClick: () => router.push("/laundry/orders/new") }} />

      {/* Offline outbox — only renders when the flag is on AND there are pending/errored rows. */}
      <PendingOrdersSection />

      {/* Status Tabs + Search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex overflow-x-auto gap-1 p-1 bg-muted rounded-lg scrollbar-none">
            {[
              { value: "ALL", label: t("orders.all"), icon: List },
              { value: "RECEIVED", label: t("status.received"), icon: Clock },
              { value: "IN_PROGRESS", label: t("status.inProgress"), icon: Package },
              { value: "READY", label: t("status.ready"), icon: CheckCircle2 },
              { value: "DELIVERED", label: t("status.delivered"), icon: Truck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = status === tab.value;
              const count = tab.value === "ALL"
                ? Object.values(statusCounts).reduce((s, c) => s + c, 0)
                : statusCounts[tab.value] ?? 0;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setStatus(tab.value)}
                  className={`shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  {count > 0 && (
                    <span className={`ml-0.5 text-xs px-1.5 py-0 rounded-full ${
                      isActive ? "bg-muted text-muted-foreground" : "bg-primary/15 text-primary"
                    }`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t("orders.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-background border-border/60" />
          </div>
        </div>
      </div>

      {/* Filters Row: Sort, Payment, Date Range - hidden for employees */}
      {!isEmployee && (
      <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Sort */}
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              className="h-9 rounded-lg border border-border/60 bg-background px-8 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Payment Filter */}
          {!isEmployee && (
            <div className="relative">
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
              >
                <option value="ALL">{t("orders.allPayments")}</option>
                <option value="PENDING">{t("status.unpaid")}</option>
                <option value="PARTIAL">{t("status.partial")}</option>
                <option value="PAID">{t("status.paid")}</option>
              </select>
            </div>
          )}

          {/* Date Range - pill style */}
          <div className="flex gap-1 overflow-x-auto">
            {DATE_RANGES.map((dr, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRangeStr(String(i))}
                className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateRangeIdx === i
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {DATE_RANGES[dateRangeIdx]?.from === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customDateFrom}
                onChange={(e) => setCustomDateFrom(e.target.value)}
                className="h-9 w-[150px] text-sm"
                placeholder="From"
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="date"
                value={customDateTo}
                onChange={(e) => setCustomDateTo(e.target.value)}
                className="h-9 w-[150px] text-sm"
                placeholder="To"
              />
            </div>
          )}
        </div>
      </div>
      )}

      {/* Orders List */}
      {loading ? (
        <TableSkeleton rows={8} />
      ) : orders.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            search || status !== "ALL" || (!isEmployee && paymentFilter !== "ALL") || dateRangeIdx !== 0
              ? t("orders.noOrdersFilter")
              : t("orders.noOrders")
          }
          action={
            !search && status === "ALL" && (isEmployee || paymentFilter === "ALL") && dateRangeIdx === 0
              ? { label: t("orders.newOrder"), onClick: () => router.push("/laundry/orders/new") }
              : undefined
          }
        />
      ) : (
        <>
          {/* Desktop: semantic table (sm and up) */}
          <div className="hidden sm:block rounded-xl border border-border/40 bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-4">{t("common.orderNumber")}</TableHead>
                  <TableHead>{t("common.customer")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                  <TableHead>{t("common.payment")}</TableHead>
                  <TableHead className="pr-4 text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => {
                  const action = NEXT_ACTION[order.status];
                  const statusCfg = ORDER_STATUS_CONFIG[order.status];
                  const payCfg = PAYMENT_STATUS_CONFIG[order.paymentStatus];
                  return (
                    <TableRow key={order.id} className="hover:bg-muted/30">
                      {/* Order# — the navigation link for the row */}
                      <TableCell className="pl-4 font-medium">
                        <Link
                          href={`/laundry/orders/${order.id}`}
                          className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 hover:underline underline-offset-4"
                        >
                          {order.orderNumber}
                        </Link>
                      </TableCell>
                      {/* Customer + date */}
                      <TableCell>
                        <div className="min-w-0">
                          <p className="truncate">{order.customerName}</p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.receivedAt || order.createdAt)}</p>
                        </div>
                      </TableCell>
                      {/* Status badge */}
                      <TableCell>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${statusCfg.color}`}>
                          {t(statusCfg.labelKey)}
                        </span>
                      </TableCell>
                      {/* Amount */}
                      <TableCell className="text-right tabular-nums font-medium">
                        {formatCurrency(order.totalAmount)}
                      </TableCell>
                      {/* Payment status */}
                      <TableCell>
                        {!isEmployee ? (
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${payCfg.color}`}>
                            {order.paymentStatus === "PARTIAL"
                              ? `${t("status.paid")} ${formatCurrency(order.paidAmount)}`
                              : t(payCfg.labelKey)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      {/* Actions */}
                      <TableCell className="pr-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          {renderOrderActions(order, action, "inline")}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards (<sm) */}
          <div className="sm:hidden space-y-3">
            {orders.map((order) => {
              const action = NEXT_ACTION[order.status];
              const statusCfg = ORDER_STATUS_CONFIG[order.status];
              const payCfg = PAYMENT_STATUS_CONFIG[order.paymentStatus];
              return (
                <Link key={order.id} href={`/laundry/orders/${order.id}`}>
                  <Card className="border border-border/40 bg-card shadow-sm rounded-xl transition-shadow hover:shadow-md mb-3">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{order.orderNumber}</span>
                            <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${statusCfg.color}`}>
                              {t(statusCfg.labelKey)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate">
                            {order.customerName}
                          </p>
                          <p className="text-xs text-muted-foreground">{formatDateTime(order.receivedAt || order.createdAt)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold tabular-nums">{formatCurrency(order.totalAmount)}</p>
                          {!isEmployee && (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${payCfg.color}`}>
                              {order.paymentStatus === "PARTIAL"
                                ? `${t("status.paid")} ${formatCurrency(order.paidAmount)}`
                                : t(payCfg.labelKey)}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Mobile: actions row below */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/40">
                        {renderOrderActions(order, action, "stacked")}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-4 border-t border-border/40">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageStr(String(Math.max(1, page - 1)))}
                disabled={page <= 1}
                className="rounded-lg"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t("common.prev")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.page").replace("{page}", String(page)).replace("{total}", String(totalPages))}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageStr(String(Math.min(totalPages, page + 1)))}
                disabled={page >= totalPages}
                className="rounded-lg"
              >
                {t("common.next")}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* Payment Dialog */}
      <Dialog open={payDialogOpen} onOpenChange={setPayDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("orderDetails.recordPayment")}</DialogTitle>
            {payOrder && (
              <p className="text-sm text-muted-foreground">{payOrder.orderNumber} — {payOrder.customerName}</p>
            )}
          </DialogHeader>
          {orderFlowV2 && payOrder && payOrder.totalAmount - payOrder.paidAmount > 0 && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    onClick={quickPay}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                  />
                }
              >
                <QrCode className="h-4 w-4" />
                {t("orderDetails.paidQrisNow")}
              </TooltipTrigger>
              <TooltipContent>{t("orderDetails.quickPayHint")}</TooltipContent>
            </Tooltip>
          )}
          <form ref={payFormRef} onSubmit={handlePayment} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("orderDetails.amount")}</Label>
              <Input
                type="number"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                placeholder="0"
                required
              />
              {payOrder && (
                <p className="text-xs text-muted-foreground">
                  {t("orderDetails.remaining")}: {formatCurrency(payOrder.totalAmount - payOrder.paidAmount)}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{t("orderDetails.paymentMethod")}</Label>
              <Select
                value={payForm.paymentMethod}
                onValueChange={(v) => v && setPayForm({ ...payForm, paymentMethod: v as "CASH" | "DEPOSIT" | "QRIS" | "TRANSFER" })}
                items={[
                  { value: "CASH", label: t("paymentMethod.cash") },
                  { value: "DEPOSIT", label: t("paymentMethod.deposit") },
                  { value: "QRIS", label: t("paymentMethod.qris") },
                  { value: "TRANSFER", label: t("paymentMethod.transfer") },
                ]}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">{t("paymentMethod.cash")}</SelectItem>
                  <SelectItem value="DEPOSIT">{t("paymentMethod.deposit")}</SelectItem>
                  <SelectItem value="QRIS">{t("paymentMethod.qris")}</SelectItem>
                  <SelectItem value="TRANSFER">{t("paymentMethod.transfer")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("orderDetails.paymentDate")}</Label>
              <Input
                type="date"
                value={payForm.paidAt}
                onChange={(e) => setPayForm({ ...payForm, paidAt: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={advancing === payOrder?.id}>
                {advancing === payOrder?.id && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {t("orderDetails.recordPayment")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
