"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  Users,
  ShoppingCart,
  Sparkles,
  Pencil,
  Settings,
  MapPin,
  Phone,
  Clock,
  MessageCircle,
  FileText,
  Save,
  X,
  Printer,
  Wifi,
  Bluetooth,
  Usb,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FormField } from "@/components/shared/form-field";
import { CardListItem } from "@/components/shared/card-list";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
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
  buildTestReceipt,
  type BluetoothPrinter,
  type SerialPrinter,
} from "@/lib/client-printer";

interface BranchUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface BranchDetail {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  latitude: number | null;
  longitude: number | null;
  googleMapsLink: string | null;
  whatsappLink: string | null;
  operatingHours: Record<string, string> | null;
  invoiceFooter: string | null;
  printerHost: string | null;
  printerPort: number | null;
  printerName: string | null;
  printerEnabled: boolean;
  printerPaperSize: string | null;
  counts: { orders: number; services: number; customers: number };
  users: BranchUser[];
}

const DEFAULT_DAYS: { key: string; label: string }[] = [
  { key: "senin", label: "Senin" },
  { key: "selasa", label: "Selasa" },
  { key: "rabu", label: "Rabu" },
  { key: "kamis", label: "Kamis" },
  { key: "jumat", label: "Jumat" },
  { key: "sabtu", label: "Sabtu" },
  { key: "minggu", label: "Minggu" },
];

const DEFAULT_HOURS = "07:00 – 19:00";

// ponytail: tiny UA sniff — just for a capability badge label, nothing security-sensitive.
function detectBrowser(): string {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/CriOS\//.test(ua)) return "Chrome";
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return "Chrome";
  if (/Firefox\//.test(ua) || /FxiOS\//.test(ua)) return "Firefox";
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return "Safari";
  return "Browser";
}

export default function BranchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { allowed, isLoading: roleLoading } = usePermissionGuard("branches", "read");
  const { t } = useTranslation();
  const [branch, setBranch] = useState<BranchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    phone: "",
    address: "",
    latitude: "",
    longitude: "",
    googleMapsLink: "",
    whatsappLink: "",
    invoiceFooter: "",
    printerHost: "",
    printerPort: "9100",
    printerName: "",
    printerEnabled: false,
    printerPaperSize: "58mm" as string,
  });
  const [hours, setHours] = useState<Record<string, string>>({});
  const [scanning, setScanning] = useState(false);
  const [scanResults, setScanResults] = useState<{ ip: string; port: number; latency: number }[]>([]);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ connected: boolean; latency?: number; error?: string } | null>(null);
  const [btAvailable, setBtAvailable] = useState(false);
  const [serialAvailable, setSerialAvailable] = useState(false);
  const [btPrinting, setBtPrinting] = useState(false);

  useEffect(() => {
    isBluetoothAvailable().then(setBtAvailable);
    isSerialAvailable().then(setSerialAvailable);
  }, []);

  const fetchBranch = useCallback(
    (id: string) => {
      apiFetch<BranchDetail>(`/api/branches/${id}`)
        .then((r) => setBranch(r.data))
        .catch(() => toast.error(t("branchDetails.failedLoad")))
        .finally(() => setLoading(false));
    },
    [t]
  );

  useEffect(() => {
    if (roleLoading || !allowed) return;
    params.then(({ id }) => {
      fetchBranch(id);
    });
  }, [params, roleLoading, allowed, fetchBranch]);

  const enterEditMode = () => {
    if (!branch) return;
    setForm({
      name: branch.name || "",
      phone: branch.phone || "",
      address: branch.address || "",
      latitude: branch.latitude != null ? String(branch.latitude) : "",
      longitude: branch.longitude != null ? String(branch.longitude) : "",
      googleMapsLink: branch.googleMapsLink || "",
      whatsappLink: branch.whatsappLink || "",
      invoiceFooter: branch.invoiceFooter || "",
      printerHost: branch.printerHost || "",
      printerPort: String(branch.printerPort || 9100),
      printerName: branch.printerName || "",
      printerEnabled: branch.printerEnabled || false,
      printerPaperSize: branch.printerPaperSize || "80mm",
    });

    const initialHours: Record<string, string> = {};
    for (const day of DEFAULT_DAYS) {
      initialHours[day.key] = branch.operatingHours?.[day.key] ?? DEFAULT_HOURS;
    }
    setHours(initialHours);
    setScanResults([]);
    setTestResult(null);
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
  };

  const handleSave = async () => {
    if (!branch) return;
    setSaving(true);
    try {
      await apiFetch(`/api/branches/${branch.id}`, {
        method: "PATCH",
        body: {
          ...form,
          latitude: form.latitude ? parseFloat(form.latitude) : null,
          longitude: form.longitude ? parseFloat(form.longitude) : null,
          operatingHours: Object.keys(hours).length > 0 ? hours : null,
          printerPort: form.printerPort ? parseInt(form.printerPort) : undefined,
          printerHost: form.printerHost || null,
          printerName: form.printerName || null,
        },
      });
      toast.success(t("common.saved") || "Branch updated successfully");
      setEditing(false);
      fetchBranch(branch.id);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : (t("branchDetails.failedSave") || "Failed to save branch"));
    } finally {
      setSaving(false);
    }
  };

  const updateForm = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleScan = async () => {
    setScanning(true);
    setScanResults([]);
    try {
      const res = await fetch("/api/printers/scan", { method: "POST" });
      const data = await res.json();
      if (data.printers) {
        setScanResults(data.printers);
        if (data.printers.length === 0) {
          toast.info(t("printer.noPrintersFound") || "No printers found on the network");
        }
      } else {
        toast.error(t("printer.scanFailed") || "Scan failed");
      }
    } catch {
      toast.error(t("printer.scanFailed") || "Network scan unavailable");
    } finally {
      setScanning(false);
    }
  };

  const handleTest = async (
    sendPrint: boolean,
    override?: { host: string; port: string; paperSize?: string }
  ) => {
    const host = override?.host ?? form.printerHost;
    const port = override?.port ?? form.printerPort;
    const paperSize = override?.paperSize ?? form.printerPaperSize;
    if (!host) {
      toast.error("Enter a printer IP first");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/printers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host,
          port: parseInt(port) || 9100,
          sendTestPrint: sendPrint,
          paperSize,
        }),
      });
      const data = await res.json();
      setTestResult(data);
      if (data.connected) {
        toast.success(sendPrint
          ? (t("printer.testPrintSent") || "Test print sent!")
          : (t("printer.connected") || `Connected (${data.latency}ms)`));
      } else {
        toast.error(data.error || "Connection failed");
      }
    } catch {
      toast.error("Test failed");
    } finally {
      setTesting(false);
    }
  };

  // ponytail: auto-scan the LAN once when entering edit mode — the "auto scan" ask.
  // Saves the owner a click; they can still hit "Scan ulang" to refresh.
  useEffect(() => {
    if (editing && scanResults.length === 0 && !scanning) {
      handleScan();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleBluetoothPrint = async () => {
    setBtPrinting(true);
    try {
      const printers = await scanBluetoothPrinters();
      if (printers.length === 0) {
        toast.info("No Bluetooth printer selected");
        return;
      }
      const printer = printers[0];
      const data = buildTestReceipt("Bluetooth", form.printerPaperSize);
      await printViaBluetooth(printer.device, data);
      toast.success(t("printer.testPrintSent") || "Test print sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bluetooth print failed");
    } finally {
      setBtPrinting(false);
    }
  };

  const handleUsbPrint = async () => {
    setBtPrinting(true);
    try {
      const printers = await scanSerialPrinters();
      if (printers.length === 0) {
        toast.info("No USB printer selected");
        return;
      }
      const printer = printers[0];
      const data = buildTestReceipt("USB", form.printerPaperSize);
      await printViaSerial(printer.port, data);
      toast.success(t("printer.testPrintSent") || "Test print sent!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "USB print failed");
    } finally {
      setBtPrinting(false);
    }
  };

  if (roleLoading || !allowed) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!branch)
    return (
      <p className="text-center py-12 text-muted-foreground">
        {t("branchDetails.notFound")}
      </p>
    );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/branches")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">
              {branch.name}
            </h1>
            <Badge
              variant={branch.isActive ? "default" : "secondary"}
              className={
                branch.isActive ? "bg-brand-600 text-white" : ""
              }
            >
              {branch.isActive ? t("status.active") : t("status.inactive")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("branchDetails.detailsAndStaff")}
          </p>
        </div>
        {!editing && (
          <Button
            variant="outline"
            size="icon"
            onClick={enterEditMode}
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <CardListItem>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-brand-600" />
              <p className="text-sm text-muted-foreground">
                {t("branchDetails.orders")}
              </p>
            </div>
            <p className="text-2xl font-bold mt-1">{branch.counts.orders}</p>
          </CardContent>
        </CardListItem>
        <CardListItem>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[oklch(0.68_0.12_40)]" />
              <p className="text-sm text-muted-foreground">
                {t("branchDetails.services")}
              </p>
            </div>
            <p className="text-2xl font-bold mt-1">{branch.counts.services}</p>
          </CardContent>
        </CardListItem>
        <CardListItem>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[oklch(0.55_0.18_30)]" />
              <p className="text-sm text-muted-foreground">
                {t("branchDetails.customers")}
              </p>
            </div>
            <p className="text-2xl font-bold mt-1">
              {branch.counts.customers}
            </p>
          </CardContent>
        </CardListItem>
      </div>

      {editing ? (
        <>
          {/* Informasi Dasar */}
          <CardListItem>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Pencil className="h-4 w-4" />
                Informasi Dasar
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField label={t("common.name")}>
                <Input
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                  placeholder="Branch name"
                />
              </FormField>
              <FormField label={t("common.phone")}>
                <Input
                  value={form.phone}
                  onChange={(e) => updateForm("phone", e.target.value)}
                  placeholder="Phone number"
                />
              </FormField>
              <FormField label={t("branches.address")}>
                <Textarea
                  value={form.address}
                  onChange={(e) => updateForm("address", e.target.value)}
                  placeholder="Branch address"
                  rows={3}
                />
              </FormField>
            </CardContent>
          </CardListItem>

          {/* Lokasi */}
          <CardListItem>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MapPin className="h-4 w-4" />
                Lokasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Latitude">
                  <Input
                    type="text"
                    value={form.latitude}
                    onChange={(e) => updateForm("latitude", e.target.value)}
                    placeholder="-6.200000"
                  />
                </FormField>
                <FormField label="Longitude">
                  <Input
                    type="text"
                    value={form.longitude}
                    onChange={(e) => updateForm("longitude", e.target.value)}
                    placeholder="106.816666"
                  />
                </FormField>
              </div>
              <FormField label="Google Maps Link">
                <Input
                  value={form.googleMapsLink}
                  onChange={(e) => updateForm("googleMapsLink", e.target.value)}
                  placeholder="https://maps.google.com/..."
                />
              </FormField>
            </CardContent>
          </CardListItem>

          {/* Kontak */}
          <CardListItem>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <MessageCircle className="h-4 w-4" />
                Kontak
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                label="WhatsApp Link"
                hint="Format: https://wa.me/62xxx"
              >
                <Input
                  value={form.whatsappLink}
                  onChange={(e) => updateForm("whatsappLink", e.target.value)}
                  placeholder="https://wa.me/62xxx"
                />
              </FormField>
            </CardContent>
          </CardListItem>

          {/* Jam Operasional */}
          <CardListItem>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="h-4 w-4" />
                Jam Operasional
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {DEFAULT_DAYS.map((day) => (
                  <div
                    key={day.key}
                    className="flex items-center gap-3 rounded-lg bg-muted/30 border border-border/30 p-3"
                  >
                    <span className="w-20 text-sm font-medium">{day.label}</span>
                    <Input
                      value={hours[day.key] || ""}
                      onChange={(e) =>
                        setHours((prev) => ({
                          ...prev,
                          [day.key]: e.target.value,
                        }))
                      }
                      placeholder={DEFAULT_HOURS}
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </CardListItem>

          {/* Invoice */}
          <CardListItem>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4" />
                Invoice
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField label="Invoice Footer">
                <Textarea
                  value={form.invoiceFooter}
                  onChange={(e) => updateForm("invoiceFooter", e.target.value)}
                  placeholder="Thank you for your business!"
                  rows={3}
                />
              </FormField>
            </CardContent>
          </CardListItem>

          {/* Printer */}
          <CardListItem>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Printer className="h-4 w-4" />
                {t("printer.title") || "Printer"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Enable toggle */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="printerEnabled"
                  checked={form.printerEnabled}
                  onChange={(e) => updateForm("printerEnabled", e.target.checked)}
                  className="h-4 w-4 rounded border-border"
                />
                <Label htmlFor="printerEnabled" className="text-sm font-medium">
                  {t("printer.enabled") || "Enable thermal printer"}
                </Label>
              </div>

              {/* Capability badges — what THIS browser can do */}
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] font-medium gap-1 bg-muted/30">
                  {detectBrowser()}
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium gap-1",
                    btAvailable ? "text-emerald-600 border-emerald-200 dark:text-emerald-400" : "text-muted-foreground/60 line-through"
                  )}
                  title={btAvailable ? "Bluetooth didukung" : "Bluetooth: hanya Chrome/Edge"}
                >
                  <Bluetooth className="h-2.5 w-2.5" /> Bluetooth
                </Badge>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-medium gap-1",
                    serialAvailable ? "text-emerald-600 border-emerald-200 dark:text-emerald-400" : "text-muted-foreground/60 line-through"
                  )}
                  title={serialAvailable ? "USB/Serial didukung" : "USB/Serial: Chrome/Firefox/Edge"}
                >
                  <Usb className="h-2.5 w-2.5" /> USB/Serial
                </Badge>
                <Badge
                  variant="outline"
                  className="text-[10px] font-medium gap-1 text-emerald-600 border-emerald-200 dark:text-emerald-400"
                  title="Berfungsi di semua browser"
                >
                  <Wifi className="h-2.5 w-2.5" /> WiFi/LAN
                </Badge>
                {!btAvailable && !serialAvailable && (
                  <span className="text-[10px] text-muted-foreground">
                    Gunakan WiFi/LAN untuk kompatibilitas penuh
                  </span>
                )}
              </div>

              {/* Paper size selector */}
              <FormField label={t("printer.paperSize") || "Paper Size"}>
                <div className="grid grid-cols-3 gap-2">
                  {(["56mm", "58mm", "80mm"] as const).map((size) => {
                    const widths: Record<string, string> = { "56mm": "w-9", "58mm": "w-10", "80mm": "w-14" };
                    const descs: Record<string, string> = {
                      "56mm": t("printer.paper56mmDesc") || "30 chars/line",
                      "58mm": t("printer.paper58mmDesc") || "32 chars/line",
                      "80mm": t("printer.paper80mmDesc") || "48 chars/line",
                    };
                    return (
                      <button
                        key={size}
                        type="button"
                        onClick={() => updateForm("printerPaperSize", size)}
                        className={`relative flex flex-col items-center gap-1 rounded-lg border-2 p-2.5 transition-all ${
                          form.printerPaperSize === size
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <div className={`${widths[size]} rounded border border-current/20 bg-white`} style={{ height: 48 }} />
                        <span className="text-xs font-semibold">{size}</span>
                        <span className="text-[9px] text-muted-foreground leading-tight text-center">{descs[size]}</span>
                      </button>
                    );
                  })}
                </div>
              </FormField>

              {/* IP + Port */}
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label={t("printer.host") || "IP Address"}>
                  <Input
                    value={form.printerHost}
                    onChange={(e) => updateForm("printerHost", e.target.value)}
                    placeholder="192.168.1.100"
                  />
                </FormField>
                <FormField label={t("printer.port") || "Port"}>
                  <Input
                    value={form.printerPort}
                    onChange={(e) => updateForm("printerPort", e.target.value)}
                    placeholder="9100"
                  />
                </FormField>
              </div>

              {/* Printer Name */}
              <FormField label={t("printer.name") || "Printer Name"}>
                <Input
                  value={form.printerName}
                  onChange={(e) => updateForm("printerName", e.target.value)}
                  placeholder="Xprinter XP-58IIH"
                />
              </FormField>

              {/* Scan + Test buttons */}
              <div className="space-y-3">
                {/* WiFi Network */}
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <Wifi className="h-3.5 w-3.5" />
                    WiFi / Network
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={handleScan} disabled={scanning}>
                      {scanning ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Wifi className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      {scanning
                        ? (t("printer.scanning") || "Scanning...")
                        : (t("printer.scanNetwork") || "Scan Network")}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleTest(false)} disabled={testing || !form.printerHost}>
                      {t("printer.testConnection") || "Test Connection"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleTest(true)} disabled={testing || !form.printerHost}>
                      {t("printer.testPrint") || "Test Print"}
                    </Button>
                  </div>
                </div>

                {/* Bluetooth */}
                {btAvailable && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Bluetooth className="h-3.5 w-3.5" />
                      {t("printer.bluetooth") || "Bluetooth"}
                    </p>
                    <Button variant="outline" size="sm" onClick={handleBluetoothPrint} disabled={btPrinting}>
                      {btPrinting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Bluetooth className="h-3.5 w-3.5 mr-1.5" />}
                      {t("printer.testPrint") || "Test Print"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Browser akan meminta pilihan printer Bluetooth
                    </p>
                  </div>
                )}

                {/* USB */}
                {serialAvailable && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <Usb className="h-3.5 w-3.5" />
                      USB / Kabel
                    </p>
                    <Button variant="outline" size="sm" onClick={handleUsbPrint} disabled={btPrinting}>
                      {btPrinting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Usb className="h-3.5 w-3.5 mr-1.5" />}
                      {t("printer.testPrint") || "Test Print"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      Browser akan meminta pilihan port USB
                    </p>
                  </div>
                )}

                {/* Browser support notice */}
                {!btAvailable && !serialAvailable && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    Bluetooth dan USB printing hanya tersedia di Chrome / Edge. WiFi printing tetap bisa digunakan.
                  </div>
                )}
              </div>

              {/* Test result */}
              {testResult && (
                <div className={`flex items-center gap-2 text-sm rounded-lg p-3 ${testResult.connected ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400" : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"}`}>
                  {testResult.connected ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 shrink-0" />
                  )}
                  <span>
                    {testResult.connected
                      ? `${t("printer.connected") || "Connected"} (${testResult.latency}ms)`
                      : testResult.error || "Connection failed"}
                  </span>
                </div>
              )}

              {/* Scan results */}
              {scanResults.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {t("printer.scanComplete") || `Found ${scanResults.length} printer(s)`}
                  </p>
                  <div className="space-y-1.5">
                    {scanResults.map((pr) => (
                      <button
                        key={pr.ip}
                        type="button"
                        onClick={() => {
                          const host = pr.ip;
                          const port = String(pr.port);
                          updateForm("printerHost", host);
                          updateForm("printerPort", port);
                          setTestResult(null);
                          // ponytail: one-step setup — picking a discovered printer auto-fires a test print.
                          handleTest(true, { host, port });
                        }}
                        className={`w-full flex items-center justify-between rounded-lg border p-2.5 text-left text-sm transition-colors ${
                          form.printerHost === pr.ip
                            ? "border-brand-600 bg-brand-600/5"
                            : "border-border/40 hover:bg-muted/50"
                        }`}
                      >
                        <div>
                          <p className="font-medium">{pr.ip}</p>
                          <p className="text-xs text-muted-foreground">
                            Port {pr.port} &middot; {pr.latency}ms
                          </p>
                        </div>
                        <span className="text-xs font-medium text-brand-600">
                          {t("printer.select") || "Select"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </CardListItem>

          {/* Save / Cancel */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105 text-white"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {t("common.save") || "Save"}
            </Button>
            <Button variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 mr-2" />
              {t("common.cancel") || "Cancel"}
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Read-only Information Card */}
          <CardListItem>
            <CardHeader>
              <CardTitle className="text-base">
                {t("branchDetails.information")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  { label: t("common.name"), value: branch.name },
                  { label: t("common.phone"), value: branch.phone },
                  {
                    label: t("branches.address"),
                    value: branch.address,
                  },
                  {
                    label: t("branchDetails.created"),
                    value: new Date(branch.createdAt).toLocaleDateString(),
                  },
                  {
                    label: "Latitude",
                    value: branch.latitude != null ? String(branch.latitude) : null,
                  },
                  {
                    label: "Longitude",
                    value:
                      branch.longitude != null ? String(branch.longitude) : null,
                  },
                  {
                    label: "Google Maps",
                    value: branch.googleMapsLink,
                  },
                  {
                    label: "WhatsApp",
                    value: branch.whatsappLink,
                  },
                ].map((field) => (
                  <div key={field.label} className="space-y-1">
                    <p className="text-sm text-muted-foreground">
                      {field.label}
                    </p>
                    <p
                      className={`font-medium ${
                        !field.value ? "text-muted-foreground italic" : ""
                      }`}
                    >
                      {field.value || t("common.notProvided")}
                    </p>
                  </div>
                ))}
              </div>
              {branch.operatingHours &&
                Object.keys(branch.operatingHours).length > 0 && (
                  <div className="mt-4 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Jam Operasional
                    </p>
                    <div className="grid gap-1 sm:grid-cols-2">
                      {Object.entries(branch.operatingHours).map(
                        ([day, time]) => (
                          <div
                            key={day}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="font-medium capitalize">
                              {day}
                            </span>
                            <span className="text-muted-foreground">{time}</span>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              {branch.invoiceFooter && (
                <div className="mt-4 space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Invoice Footer
                  </p>
                  <p className="font-medium whitespace-pre-line">
                    {branch.invoiceFooter}
                  </p>
                </div>
              )}

              {/* Printer Status */}
              <div className="mt-4 space-y-2">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Printer className="h-3.5 w-3.5" />
                  {t("printer.title") || "Printer"}
                </p>
                {branch.printerHost ? (
                  <div className="rounded-lg bg-muted/30 border border-border/40 p-3 space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">IP</span>
                      <span className="font-medium">{branch.printerHost}:{branch.printerPort}</span>
                    </div>
                    {branch.printerName && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{t("printer.name") || "Name"}</span>
                        <span className="font-medium">{branch.printerName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("printer.paperSize") || "Paper Size"}</span>
                      <span className="font-medium">{branch.printerPaperSize || "80mm"}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{t("common.status") || "Status"}</span>
                      <span className={`flex items-center gap-1 font-medium ${branch.printerEnabled ? "text-emerald-600" : "text-muted-foreground"}`}>
                        {branch.printerEnabled ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                        {branch.printerEnabled ? (t("status.active") || "Active") : (t("status.inactive") || "Inactive")}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    {t("printer.notConfigured") || "Not configured"}
                  </p>
                )}
              </div>
            </CardContent>
          </CardListItem>
        </>
      )}

      {/* Staff List Card */}
      <CardListItem>
        <CardHeader>
          <CardTitle className="text-base">
            {t("branchDetails.assignedStaff")} ({branch.users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {branch.users.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              {t("branchDetails.noStaff")}
            </p>
          ) : (
            <div className="space-y-3">
              {branch.users.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-lg bg-muted/30 border border-border/40 p-3"
                >
                  <div>
                    <p className="font-medium">{u.name}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                  <Badge
                    variant={u.role === "OWNER" ? "default" : "secondary"}
                    className={
                      u.role === "OWNER"
                        ? "bg-brand-600 text-white"
                        : ""
                    }
                  >
                    {u.role === "OWNER"
                      ? t("role.owner")
                      : t("role.employee")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </CardListItem>
    </div>
  );
}
