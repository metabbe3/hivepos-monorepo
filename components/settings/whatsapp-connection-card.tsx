"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Wifi, WifiOff, QrCode, Power, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface WhatsAppStatus {
  status: string; // disconnected | connecting | qr_ready | connected | reconnecting
  phoneNumber: string | null;
  qr?: string | null;
}

/**
 * WhatsApp Connection Card — manages the Baileys session for this tenant.
 * Shows QR code for scanning, connection status, and test-send.
 */
export function WhatsAppConnectionCard() {
  const [status, setStatus] = useState<WhatsAppStatus>({ status: "disconnected", phoneNumber: null });
  const [loading, setLoading] = useState(false);
  const [notEnabled, setNotEnabled] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("Test dari hivePOS WhatsApp");
  const [polling, setPolling] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const { data } = await apiFetch<WhatsAppStatus>("/api/whatsapp/status");
      setStatus(data);
      setNotEnabled(false);
    } catch (err) {
      if (err instanceof ApiClientError && err.httpStatus === 403) {
        setNotEnabled(true);
      }
      setStatus({ status: "disconnected", phoneNumber: null });
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Poll QR every 3s while connecting (QR auto-refreshes in gateway).
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await apiFetch<WhatsAppStatus>("/api/whatsapp/qr");
        setStatus(data);
        if (data.status === "connected") {
          setPolling(false);
          toast.success("WhatsApp terhubung!");
        }
      } catch {
        // ignore — keep polling
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [polling]);

  async function handleConnect() {
    setLoading(true);
    try {
      const { data } = await apiFetch<WhatsAppStatus>("/api/whatsapp/connect", { method: "POST" });
      setStatus(data);
      setPolling(true);
      toast.info("Scan QR code untuk menghubungkan WhatsApp");
    } catch {
      toast.error("Gagal menghubungkan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await apiFetch("/api/whatsapp/disconnect", { method: "POST" });
      setStatus({ status: "disconnected", phoneNumber: null });
      setPolling(false);
      toast.success("WhatsApp diputus");
    } catch {
      toast.error("Gagal memutus");
    } finally {
      setLoading(false);
    }
  }

  async function handleTestSend() {
    if (!testPhone.trim()) {
      toast.error("Masukkan nomor telepon");
      return;
    }
    try {
      await apiFetch("/api/whatsapp/send", {
        method: "POST",
        body: { phone: testPhone.trim(), message: testMsg },
      });
      toast.success("Pesan tes terkirim!");
    } catch (e) {
      toast.error("Gagal mengirim. Pastikan WhatsApp terhubung.");
    }
  }

  const isConnected = status.status === "connected";

  if (notEnabled) {
    return (
      <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
        <CardContent className="py-6 text-center">
          <WifiOff className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">WhatsApp Automation Not Enabled</p>
          <p className="text-xs text-muted-foreground mt-1">
            Hubungi admin untuk mengaktifkan fitur WhatsApp.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            isConnected ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-muted",
          )}>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-emerald-600" />
            ) : (
              <WifiOff className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <CardTitle className="text-base font-bold">WhatsApp Connection</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isConnected
                ? `Connected: ${status.phoneNumber}`
                : status.status === "connecting" || status.status === "qr_ready"
                  ? "Menunggu scan QR..."
                  : "Not connected"}
            </p>
          </div>
        </div>
        <Badge variant={isConnected ? "default" : "outline"} className={isConnected ? "bg-emerald-600" : ""}>
          {status.status}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* QR Code */}
        {!isConnected && status.qr && (
          <div className="flex flex-col items-center gap-2 py-2">
            <img src={status.qr} alt="WhatsApp QR Code" className="rounded-xl border border-border/40" width={256} height={256} />
            <p className="text-xs text-muted-foreground text-center">
              Buka WhatsApp → Pengaturan → Perangkat tertaut → Pindai kode QR
            </p>
          </div>
        )}

        {/* Connect / Disconnect */}
        <div className="flex gap-2">
          {!isConnected ? (
            <Button onClick={handleConnect} disabled={loading} className="gap-1.5">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
              Hubungkan
            </Button>
          ) : (
            <Button onClick={handleDisconnect} disabled={loading} variant="outline" className="gap-1.5 text-destructive">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Power className="h-4 w-4" />}
              Putuskan
            </Button>
          )}
        </div>

        {/* Test send (only when connected) */}
        {isConnected && (
          <div className="space-y-2 border-t border-border/40 pt-3">
            <Label className="text-xs text-muted-foreground">Test Kirim Pesan</Label>
            <div className="flex gap-2">
              <Input
                placeholder="0812xxxxxxx"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleTestSend} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />
                Kirim
              </Button>
            </div>
            <Input
              placeholder="Pesan..."
              value={testMsg}
              onChange={(e) => setTestMsg(e.target.value)}
              className="text-sm"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
