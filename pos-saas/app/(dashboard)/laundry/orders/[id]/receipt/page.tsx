"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";
import { BUSINESS_NAME_KEY } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Printer, Loader2, ReceiptText, Bluetooth, Usb, Wifi, CheckCircle2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { cn } from "@/lib/utils";
import {
  isBluetoothAvailable,
  isSerialAvailable,
  scanBluetoothPrinters,
  scanSerialPrinters,
  printViaBluetooth,
  printViaSerial,
  buildClientReceipt,
  rememberPrinter,
  getRememberedPrinter,
  reconnectBluetooth,
  reconnectSerial,
} from "@/lib/client-printer";
import { queueTelemetry } from "@/lib/client-telemetry";

// ponytail: one helper for all 4 print paths — keep timing + queueing in one place
// rather than duplicating across handleThermal/Bluetooth/Usb/Browser. Each path
// calls this with its kind and the t0 captured at method entry.
type PrintKind = "network" | "bluetooth" | "usb" | "browser";
function reportPrint(kind: PrintKind, t0: number, ok: boolean, orderId?: string, error?: string) {
  queueTelemetry("print", { kind, ok, ms: Math.round(performance.now() - t0), orderId, error });
}

interface OrderItem {
  id: string;
  serviceName: string;
  quantity: number;
  weightKg: number | null;
  subtotal: number;
  garmentBreakdown: { name: string; qty: number }[] | null;
}

interface Payment {
  id: string;
  amount: number;
  paymentMethod: string;
  paidAt: string;
}

interface OrderReceipt {
  id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: string;
  notes: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  orderItems: OrderItem[];
  payments: Payment[];
  branch: { name: string | null; phone: string | null; address: string | null };
  /** Branch thermal-paper size — drives the receipt width. Falls back to 58mm. */
  printerPaperSize?: string | null;
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { t } = useTranslation();
  const [order, setOrder] = useState<OrderReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);
  const [btAvailable, setBtAvailable] = useState(false);
  const [serialAvailable, setSerialAvailable] = useState(false);
  const [directPrinting, setDirectPrinting] = useState(false);
  const [paperSize, setPaperSize] = useState<string>("58mm");
  const [branchPrinter, setBranchPrinter] = useState<{ host: string | null; port: number | null; enabled: boolean } | null>(null);
  const [readyPrinter, setReadyPrinter] = useState<string | null>(null);

  const isSmall = paperSize === "56mm" || paperSize === "58mm";

  useEffect(() => {
    isBluetoothAvailable().then(setBtAvailable);
    isSerialAvailable().then(setSerialAvailable);
  }, []);

  useEffect(() => {
    params.then(({ id }) => {
      apiFetch<OrderReceipt>(`/api/orders/${id}`)
        .then((r) => {
          const data = r.data;
          setOrder({
            ...data,
            totalAmount: Number(data.totalAmount ?? 0),
            paidAmount: Number(data.paidAmount ?? 0),
            payments: (data.payments ?? []).map((p: Payment) => ({ ...p, amount: Number(p.amount ?? 0) })),
          });
          // Paper size comes from the order's branch (single source of truth) —
          // reliable in "Semua Outlet" mode, unlike the prior /api/user fetch.
          if (data.printerPaperSize) setPaperSize(data.printerPaperSize);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [params]);

  // Fetch network printer config from branch (paper size comes from the order).
  useEffect(() => {
    apiFetch<{ branchId: string }>("/api/user")
      .then((r) => {
        if (r.data?.branchId) {
          return apiFetch<{
            printerHost: string | null;
            printerPort: number | null;
            printerEnabled: boolean;
          }>(`/api/branches/${r.data.branchId}`);
        }
        return null;
      })
      .then((res) => {
        if (!res?.data) return;
        setBranchPrinter({
          host: res.data.printerHost,
          port: res.data.printerPort,
          enabled: res.data.printerEnabled,
        });
      })
      .catch(() => {});
  }, []);

  // ponytail: silent auto-reconnect ("auto on") — try the remembered Bluetooth printer on load.
  useEffect(() => {
    const remembered = getRememberedPrinter();
    if (remembered) setReadyPrinter(remembered.label);
    if (remembered?.kind === "bluetooth") {
      reconnectBluetooth()
        .then((dev) => {
          if (dev) setReadyPrinter(dev.name || remembered.label);
        })
        .catch(() => {});
    }
  }, []);

  const networkReady = !!(branchPrinter?.enabled && branchPrinter.host);

  const handleBrowserPrint = useCallback(() => {
    const t0 = performance.now();
    // Inject dynamic @page size before printing
    const style = document.createElement("style");
    style.id = "dynamic-print-page";
    style.textContent = `@page { size: ${paperSize} auto; margin: 0; }`;
    document.head.appendChild(style);
    try {
      window.print();
      reportPrint("browser", t0, true, order?.id);
    } catch (e) {
      reportPrint("browser", t0, false, order?.id, e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      // Clean up after a short delay
      setTimeout(() => {
        const el = document.getElementById("dynamic-print-page");
        if (el) el.remove();
      }, 1000);
    }
  }, [paperSize, order?.id]);

  // ponytail: shared builder — the three direct methods used to duplicate this 12-line mapping.
  function buildReceiptData(): Uint8Array {
    return buildClientReceipt({
      orderNumber: order!.orderNumber,
      status: order!.status,
      totalAmount: order!.totalAmount,
      paidAmount: order!.paidAmount,
      notes: order!.notes,
      createdAt: order!.createdAt,
      customer: { name: order!.customerName, phone: order!.customerPhone ?? "" },
      orderItems: order!.orderItems.map((i) => ({
        quantity: i.quantity,
        weightKg: i.weightKg,
        subtotal: i.subtotal,
        service: { name: i.serviceName, pricingType: i.weightKg ? "PER_KG" : "PER_ITEM" },
        garmentBreakdown: i.garmentBreakdown,
      })),
      branch: order!.branch,
    }, t(BUSINESS_NAME_KEY), paperSize);
  }

  async function handleThermalPrint() {
    if (!order) return;
    setPrinting(true);
    try {
      await apiFetch("/api/print", {
        method: "POST",
        body: { orderId: order.id },
      });
      toast.success(t("receipt.printed"));
      if (branchPrinter?.host) {
        const id = `${branchPrinter.host}:${branchPrinter.port ?? 9100}`;
        rememberPrinter({ kind: "network", id, label: branchPrinter.host });
        setReadyPrinter(branchPrinter.host);
      }
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("receipt.failedPrint"));
    } finally {
      setPrinting(false);
    }
  }

  async function handleBluetoothPrint() {
    if (!order) return;
    const t0 = performance.now();
    setDirectPrinting(true);
    try {
      const printers = await scanBluetoothPrinters();
      if (printers.length === 0) return;
      const data = buildReceiptData();
      const printer = printers[0];
      await printViaBluetooth(printer.device, data);
      reportPrint("bluetooth", t0, true, order.id);
      toast.success(t("receipt.printed"));
      rememberPrinter({ kind: "bluetooth", id: printer.device.id, label: printer.device.name || "Bluetooth" });
      setReadyPrinter(printer.device.name || "Bluetooth");
    } catch (err) {
      reportPrint("bluetooth", t0, false, order.id, err instanceof Error ? err.message : String(err));
      toast.error(err instanceof Error ? err.message : t("receipt.failedPrint"));
    } finally {
      setDirectPrinting(false);
    }
  }

  async function handleUsbPrint() {
    if (!order) return;
    const t0 = performance.now();
    setDirectPrinting(true);
    try {
      const printers = await scanSerialPrinters();
      if (printers.length === 0) return;
      const data = buildReceiptData();
      const printer = printers[0];
      await printViaSerial(printer.port, data);
      reportPrint("usb", t0, true, order.id);
      toast.success(t("receipt.printed"));
      rememberPrinter({ kind: "serial", id: printer.id, label: printer.name });
      setReadyPrinter(printer.name);
    } catch (err) {
      reportPrint("usb", t0, false, order.id, err instanceof Error ? err.message : String(err));
      toast.error(err instanceof Error ? err.message : t("receipt.failedPrint"));
    } finally {
      setDirectPrinting(false);
    }
  }

  // ponytail: the "one smart button" — pick the best available method, fall back gracefully.
  async function handleSmartPrint() {
    const remembered = getRememberedPrinter();
    // 1. remembered network → server print
    if (remembered?.kind === "network" && networkReady) {
      return handleThermalPrint();
    }
    // 2. remembered bluetooth → silent reconnect, then print
    if (remembered?.kind === "bluetooth" && btAvailable) {
      const t0 = performance.now();
      const dev = await reconnectBluetooth();
      if (dev && order) {
        setDirectPrinting(true);
        try {
          await printViaBluetooth(dev, buildReceiptData());
          reportPrint("bluetooth", t0, true, order.id);
          toast.success(t("receipt.printed"));
          rememberPrinter({ kind: "bluetooth", id: dev.id, label: dev.name || "Bluetooth" });
          setReadyPrinter(dev.name || "Bluetooth");
          return;
        } catch (err) {
          reportPrint("bluetooth", t0, false, order.id, err instanceof Error ? err.message : String(err));
          toast.error(err instanceof Error ? err.message : t("receipt.failedPrint"));
        } finally {
          setDirectPrinting(false);
        }
      }
    }
    // 2b. remembered serial (USB) → silent reconnect via getPorts(), then print
    if (remembered?.kind === "serial" && serialAvailable) {
      const t0 = performance.now();
      const port = await reconnectSerial();
      if (port && order) {
        setDirectPrinting(true);
        try {
          await printViaSerial(port, buildReceiptData());
          reportPrint("usb", t0, true, order.id);
          toast.success(t("receipt.printed"));
          rememberPrinter({ kind: "serial", id: remembered.id, label: remembered.label });
          setReadyPrinter(remembered.label);
          return;
        } catch (err) {
          reportPrint("usb", t0, false, order.id, err instanceof Error ? err.message : String(err));
          toast.error(err instanceof Error ? err.message : t("receipt.failedPrint"));
        } finally {
          setDirectPrinting(false);
        }
      }
    }
    // 3. network configured (best universal default)
    if (networkReady) return handleThermalPrint();
    // 4. bluetooth available (will pop picker first time)
    if (btAvailable) return handleBluetoothPrint();
    // 5. serial available
    if (serialAvailable) return handleUsbPrint();
    // 6. last resort — always works
    handleBrowserPrint();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!order) {
    return <p className="text-center py-12 text-muted-foreground">{t("receipt.failedLoad")}</p>;
  }

  const remaining = order.totalAmount - order.paidAmount;

  // Calculate total pcs
  const totalPcs = order.orderItems.reduce((sum, item) => {
    if (item.weightKg) return sum; // per-kg items don't count as pieces
    return sum + (item.garmentBreakdown?.reduce((s, g) => s + g.qty, 0) || item.quantity);
  }, 0);
  const fontSize = isSmall ? "text-[10px]" : "text-[11px]";
  const smallFont = isSmall ? "text-[9px]" : "text-[10px]";
  const qtyWidth = isSmall ? "w-8" : "w-10";
  const priceWidth = isSmall ? "w-16" : "w-20";
  const pxClass = isSmall ? "px-3" : "px-5";

  return (
    <div className="max-w-md mx-auto">
      {/* Action buttons - hidden when printing */}
      <div className="print:hidden mb-6 space-y-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">{t("receipt.title")}</h1>
          <div className="ml-auto flex items-center gap-2">
            {readyPrinter && (
              <Badge
                variant="outline"
                className="hidden sm:inline-flex gap-1 text-[11px] text-emerald-600 border-emerald-200 dark:text-emerald-400"
                title={t("receipt.printerReady") ?? "Printer terakhir digunakan"}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{readyPrinter}</span>
              </Badge>
            )}
            <Button
              onClick={handleSmartPrint}
              disabled={printing || directPrinting}
              className="bg-gradient-to-r from-brand-600 to-brand-700 text-white shadow-md shadow-brand-600/15 hover:brightness-105"
            >
              {printing || directPrinting ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-1.5 h-4 w-4" />
              )}
              {t("receipt.printReceipt") ?? "Cetak Struk"}
            </Button>
          </div>
        </div>

        {/* Explicit method fallbacks — only supported methods shown */}
        <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0 sm:justify-end">
          <Button variant="outline" size="sm" onClick={handleBrowserPrint}>
            <ReceiptText className="mr-1.5 h-3.5 w-3.5" />
            {t("receipt.browserPrint") ?? "Browser"}
          </Button>
          {networkReady && (
            <Button variant="outline" size="sm" onClick={handleThermalPrint} disabled={printing}>
              {printing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wifi className="mr-1.5 h-3.5 w-3.5" />}
              {t("receipt.networkPrint") ?? "Jaringan"}
            </Button>
          )}
          {btAvailable && (
            <Button variant="outline" size="sm" onClick={handleBluetoothPrint} disabled={directPrinting}>
              {directPrinting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Bluetooth className="mr-1.5 h-3.5 w-3.5" />}
              Bluetooth
            </Button>
          )}
          {serialAvailable && (
            <Button variant="outline" size="sm" onClick={handleUsbPrint} disabled={directPrinting}>
              {directPrinting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Usb className="mr-1.5 h-3.5 w-3.5" />}
              USB
            </Button>
          )}
        </div>

        {/* Paper size — live preview + print width (no reload needed) */}
        <div className="flex flex-wrap items-center gap-2 pl-12 sm:pl-0 sm:justify-end">
          <span className="text-xs text-muted-foreground">
            {t("printerSettings.paperSize")}
          </span>
          {(["56mm", "58mm", "80mm"] as const).map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setPaperSize(size)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                paperSize === size
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "border border-border/40 text-muted-foreground hover:bg-muted/60"
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        {/* Cross-browser honesty — Safari/iOS path */}
        {!btAvailable && !serialAvailable && (
          <p className={cn("text-[11px] text-muted-foreground pl-12 sm:pl-0 sm:text-right")}>
            {t("receipt.browserLimitedNote") ??
              "Browser ini hanya mendukung cetak via Jaringan (WiFi/LAN) atau Browser Print. Untuk Bluetooth/USB, gunakan Chrome atau Edge."}
          </p>
        )}
      </div>

      {/* Receipt body - thermal paper styled */}
      <div className={`receipt-thermal receipt-${paperSize} bg-white text-black rounded-xl border border-border/40 shadow-sm p-0 print:border-none print:shadow-none print:rounded-none`}>
        <div className={`${pxClass} py-4 print:px-2 print:py-3`}>
          {/* Header */}
          <div className="text-center mb-3">
            <div className={`font-bold tracking-wide uppercase ${isSmall ? "text-[12px]" : "text-base"}`}>
              {t(BUSINESS_NAME_KEY)}
            </div>
            {order.branch?.address && (
              <div className={`${smallFont} text-gray-600 mt-0.5 leading-tight`}>
                {order.branch.address}
              </div>
            )}
            {order.branch?.phone && (
              <div className={`${smallFont} text-gray-600 mt-0.5`}>
                {order.branch.phone}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Order info */}
          <div className={`${fontSize} space-y-0.5`}>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("receipt.order")}</span>
              <span className="font-medium">{order.orderNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("common.date")}</span>
              <span className="font-medium">{formatDate(order.createdAt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("common.status")}</span>
              <span className="font-medium">{t("enum.orderStatus." + order.status)}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Customer */}
          <div className={`${fontSize} space-y-0.5`}>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("receipt.customer")}</span>
              <span className="font-medium">{order.customerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("common.phone")}</span>
              <span className="font-medium">{order.customerPhone}</span>
            </div>
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Items header */}
          <div className={`${fontSize} font-bold flex justify-between mb-1`}>
            <span className="flex-1">{t("newOrder.orderItems")}</span>
            <span className={`${qtyWidth} text-center`}>Qty</span>
            <span className={`${priceWidth} text-right`}>Subtotal</span>
          </div>

          {/* Items */}
          <div className={`${fontSize} space-y-0.5`}>
            {order.orderItems.map((item) => {
              const qtyLabel = item.weightKg
                ? `${item.weightKg}kg`
                : `${item.quantity}x`;
              return (
                <div key={item.id}>
                  <div className="flex justify-between items-start">
                    <span className="flex-1 leading-tight">{item.serviceName}</span>
                    <span className={`${qtyWidth} text-center`}>{qtyLabel}</span>
                    <span className={`${priceWidth} text-right`}>{formatCurrency(item.subtotal)}</span>
                  </div>
                  {item.garmentBreakdown && item.garmentBreakdown.length > 0 && (
                    <div className="pl-2 text-gray-500" style={{ fontSize: isSmall ? '8px' : '9px' }}>
                      {item.garmentBreakdown.map((g, i) => (
                        <div key={i} className="flex">
                          <span className="flex-1">- {g.name}</span>
                          <span>{g.qty}x</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="border-t border-dashed border-gray-400 my-2" />

          {/* Total pcs */}
          {totalPcs > 0 && (
            <div className={`${fontSize} flex justify-between mb-1`}>
              <span className="text-gray-600">{t("garment.totalItems").replace("{count}", String(totalPcs))}</span>
            </div>
          )}

          {/* Totals */}
          <div className={`${fontSize} space-y-1`}>
            <div className={`flex justify-between font-bold ${isSmall ? "text-[11px]" : "text-sm"}`}>
              <span>{t("common.total")}</span>
              <span>{formatCurrency(order.totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">{t("orderDetails.paid")}</span>
              <span className="text-emerald-700">{formatCurrency(order.paidAmount)}</span>
            </div>
            {remaining > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">{t("orderDetails.remaining")}</span>
                <span className="font-medium text-red-700">{formatCurrency(remaining)}</span>
              </div>
            )}
          </div>

          {/* Payment method */}
          {order.payments.length > 0 && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className={`${smallFont} text-gray-500 space-y-0.5`}>
                {order.payments.map((p) => (
                  <div key={p.id} className="flex justify-between">
                    <span>{t("enum.paymentMethod." + p.paymentMethod)}</span>
                    <span>{formatCurrency(p.amount)}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Notes */}
          {order.notes && (
            <>
              <div className="border-t border-dashed border-gray-400 my-2" />
              <div className={smallFont}>
                <span className="text-gray-600">{t("receipt.notes")}: </span>
                <span>{order.notes}</span>
              </div>
            </>
          )}

          {/* Footer */}
          <div className="border-t border-dashed border-gray-400 my-2" />
          <div className={`text-center ${smallFont} text-gray-500 space-y-0.5`}>
            <div>Terima kasih atas kepercayaan Anda</div>
            <div>Simpan struk ini sebagai bukti transaksi</div>
          </div>
        </div>
      </div>
    </div>
  );
}
