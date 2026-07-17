"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bluetooth, Usb, Wifi, Printer as PrinterIcon, CheckCircle2, Trash2, Loader2, PrinterCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch, ApiClientError } from "@/modules/shared";
import {
  isBluetoothAvailable,
  isSerialAvailable,
  scanBluetoothPrinters,
  scanSerialPrinters,
  printViaBluetooth,
  printViaSerial,
  reconnectBluetooth,
  reconnectSerial,
  buildTestReceipt,
  rememberPrinter,
  getRememberedPrinter,
  forgetPrinter,
  type RememberedPrinter,
} from "@/lib/client-printer";

/**
 * Printer settings — pick + save the default printer once. The receipt page
 * (handleSmartPrint) auto-routes to the remembered printer without popping the
 * picker. Bluetooth/USB are device-local (localStorage); network is branch-level
 * (DB, configured by Owner in /branches/[id]).
 */
export default function PrinterSettingsPage() {
  const { t } = useTranslation();
  const [btAvailable, setBtAvailable] = useState(false);
  const [serialAvailable, setSerialAvailable] = useState(false);
  const [remembered, setRemembered] = useState<RememberedPrinter | null>(null);
  const [busy, setBusy] = useState<"bt" | "usb" | "test" | null>(null);
  const [paperSize, setPaperSize] = useState<string>("58mm");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [branchPrinter, setBranchPrinter] = useState<{ host: string | null; port: number | null; enabled: boolean } | null>(null);

  useEffect(() => {
    isBluetoothAvailable().then(setBtAvailable);
    isSerialAvailable().then(setSerialAvailable);
    setRemembered(getRememberedPrinter());
  }, []);

  // Read paper size + network printer config from the branch (same shape as the receipt page).
  useEffect(() => {
    apiFetch<{ branchId: string }>("/api/user")
      .then((r) => {
        if (r.data?.branchId) {
          setBranchId(r.data.branchId);
          return apiFetch<{
            printerPaperSize: string | null;
            printerHost: string | null;
            printerPort: number | null;
            printerEnabled: boolean;
          }>(`/api/branches/${r.data.branchId}`);
        }
        return null;
      })
      .then((res) => {
        if (!res?.data) return;
        if (res.data.printerPaperSize) setPaperSize(res.data.printerPaperSize);
        setBranchPrinter({
          host: res.data.printerHost,
          port: res.data.printerPort,
          enabled: res.data.printerEnabled,
        });
      })
      .catch(() => {});
  }, []);

  async function changePaperSize(size: string) {
    setPaperSize(size);
    if (!branchId || branchId === "ALL") {
      toast.error(t("printerSettings.paperSizePickOutlet"));
      return;
    }
    try {
      await apiFetch(`/api/branches/${branchId}`, {
        method: "PATCH",
        body: { printerPaperSize: size },
      });
      toast.success(t("printerSettings.saved"));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("receipt.failedPrint"));
    }
  }

  function refresh() {
    setRemembered(getRememberedPrinter());
  }

  async function pairBluetooth() {
    setBusy("bt");
    try {
      const printers = await scanBluetoothPrinters();
      if (printers.length === 0) return; // user cancelled
      const dev = printers[0].device;
      // Verify we can actually talk to it before saving.
      await printViaBluetooth(dev, buildTestReceipt(undefined, paperSize));
      rememberPrinter({ kind: "bluetooth", id: dev.id, label: dev.name || "Bluetooth" });
      refresh();
      toast.success(t("printerSettings.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("receipt.failedPrint"));
    } finally {
      setBusy(null);
    }
  }

  async function pairUsb() {
    setBusy("usb");
    try {
      const printers = await scanSerialPrinters();
      if (printers.length === 0) return;
      const printer = printers[0];
      await printViaSerial(printer.port, buildTestReceipt(undefined, paperSize));
      rememberPrinter({ kind: "serial", id: printer.id, label: printer.name });
      refresh();
      toast.success(t("printerSettings.saved"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("receipt.failedPrint"));
    } finally {
      setBusy(null);
    }
  }

  async function testPrint() {
    if (!remembered) {
      toast.error(t("printerSettings.none"));
      return;
    }
    setBusy("test");
    try {
      const data = buildTestReceipt(undefined, paperSize);
      if (remembered.kind === "bluetooth") {
        const dev = await reconnectBluetooth();
        if (!dev) throw new Error("Printer tidak ditemukan — pasang ulang");
        await printViaBluetooth(dev, data);
      } else if (remembered.kind === "serial") {
        const port = await reconnectSerial();
        if (!port) throw new Error("Printer tidak ditemukan — pasang ulang");
        await printViaSerial(port, data);
      } else {
        // Network test-print runs from the receipt page (server-side TCP, order-scoped).
        toast.message(t("printerSettings.networkHint"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("receipt.failedPrint"));
    } finally {
      setBusy(null);
    }
  }

  const networkActive = !!(branchPrinter?.enabled && branchPrinter.host);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
          <PrinterIcon className="h-6 w-6 text-indigo-600" />
          {t("printerSettings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("printerSettings.subtitle")}</p>
      </div>

      {/* Current remembered printer */}
      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("printerSettings.current")}
            </div>
            {remembered ? (
              <div className="mt-1 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <Badge variant="outline" className="capitalize">{remembered.kind}</Badge>
                <span className="truncate font-medium">{remembered.label}</span>
              </div>
            ) : (
              <div className="mt-1 text-sm text-muted-foreground">{t("printerSettings.none")}</div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={testPrint} disabled={!remembered || busy !== null} variant="outline" size="sm">
              {busy === "test" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <PrinterCheck className="mr-1.5 h-3.5 w-3.5" />}
              {t("printerSettings.test")}
            </Button>
            {remembered && (
              <Button
                onClick={() => {
                  forgetPrinter();
                  refresh();
                }}
                variant="outline"
                size="sm"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("printerSettings.forget")}
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Paper size — drives the receipt character width (per outlet) */}
      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">{t("printerSettings.paperSize")}</div>
            <div className="text-sm text-muted-foreground">
              {t("printerSettings.paperSizeHint")}
            </div>
          </div>
          <div className="flex gap-2">
            {["56mm", "58mm", "80mm"].map((size) => (
              <Button
                key={size}
                size="sm"
                variant={paperSize === size ? "default" : "outline"}
                onClick={() => changePaperSize(size)}
              >
                {size}
              </Button>
            ))}
          </div>
        </div>
      </section>

      {/* Pairing options */}
      <section className="grid gap-3 sm:grid-cols-2">
        <PairCard
          icon={<Bluetooth className="h-5 w-5 text-blue-600" />}
          title={t("printerSettings.bluetooth")}
          available={btAvailable}
          availableNote={t("printerSettings.notAvailable")}
          busy={busy === "bt"}
          onPick={pairBluetooth}
          pickLabel={t("printerSettings.pickBluetooth")}
          t={t}
        />
        <PairCard
          icon={<Usb className="h-5 w-5 text-violet-600" />}
          title={t("printerSettings.usb")}
          available={serialAvailable}
          availableNote={t("printerSettings.notAvailable")}
          busy={busy === "usb"}
          onPick={pairUsb}
          pickLabel={t("printerSettings.pickUsb")}
          t={t}
        />
      </section>

      {/* Network status (read-only; owner configures in /branches/[id]) */}
      <section className="rounded-xl border border-border/60 bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Wifi className={`h-5 w-5 ${networkActive ? "text-emerald-600" : "text-muted-foreground"}`} />
            <div>
              <div className="font-medium">{t("printerSettings.network")}</div>
              {networkActive ? (
                <div className="text-sm text-muted-foreground">
                  {branchPrinter!.host}:{branchPrinter!.port ?? 9100}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">{t("printerSettings.networkInactive")}</div>
              )}
            </div>
          </div>
          {networkActive ? (
            <Badge variant="outline" className="gap-1 border-emerald-200 text-emerald-700">
              <CheckCircle2 className="h-3 w-3" />
              {t("printerSettings.networkActive")}
            </Badge>
          ) : null}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("printerSettings.networkHint")}</p>
      </section>
    </div>
  );
}

function PairCard({
  icon,
  title,
  available,
  availableNote,
  busy,
  onPick,
  pickLabel,
  t,
}: {
  icon: React.ReactNode;
  title: string;
  available: boolean;
  availableNote: string;
  busy: boolean;
  onPick: () => void;
  pickLabel: string;
  t: (k: string) => string;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-card p-5">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-medium">{title}</span>
      </div>
      {available ? (
        <Button onClick={onPick} disabled={busy} className="mt-auto">
          {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {pickLabel}
        </Button>
      ) : (
        <p className="mt-auto text-xs text-muted-foreground">{availableNote}</p>
      )}
    </div>
  );
}
