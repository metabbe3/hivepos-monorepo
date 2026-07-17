"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  Clock,
  User,
  FileText,
  CheckCircle2,
  XCircle,
  Truck,
  Package,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/modules/shared";
import type { PickupRequestDTO } from "@/modules/pickup-requests/application/dto";
import type { OrderStatus } from "@/app/generated/prisma/enums";
import { ORDER_STATUS_CONFIG } from "@/lib/constants";
import {
  PICKUP_STATUS_BADGE,
  PICKUP_STATUS_LABEL,
} from "@/modules/pickup-requests/ui/status-styles";

interface Props {
  pickupId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called whenever the pickup is mutated so the list can refresh. */
  onMutated: () => void;
}

/**
 * Extended pickup shape with the linked Order summary (return delivery leg).
 * The API includes this when `convertedOrderId` is non-null; it's optional
 * here so we degrade gracefully on older responses.
 */
type PickupWithOrder = PickupRequestDTO & {
  convertedOrderSummary?: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    deliveredAt: string | null;
  } | null;
};

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  RECEIVED: "Diterima",
  IN_PROGRESS: "Diproses",
  READY: "Siap",
  DELIVERED: "Terkirim",
  CANCELED: "Dibatalkan",
};

function nextDates(count = 14): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("id-ID", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
    });
  }
  return out;
}

const DEFAULT_SLOTS = [
  "09:00-11:00",
  "11:00-13:00",
  "13:00-15:00",
  "15:00-17:00",
  "17:00-19:00",
];

export function PickupRequestDetailDialog({
  pickupId,
  open,
  onOpenChange,
  onMutated,
}: Props) {
  const router = useRouter();
  const [pickup, setPickup] = useState<PickupWithOrder | null>(null);
  const [loading, setLoading] = useState(false);

  // Schedule form
  const [scheduleForm, setScheduleForm] = useState({
    requestedDate: "",
    requestedSlot: "",
    assignedDriverId: "",
  });

  // Reject form
  const [rejectReason, setRejectReason] = useState("");

  // Driver assignment
  const [driverForm, setDriverForm] = useState("");

  const [pending, setPending] = useState<string>("");

  useEffect(() => {
    if (!pickupId || !open) {
      setPickup(null);
      return;
    }
    setLoading(true);
    apiFetch<PickupWithOrder>(`/api/pickup-requests/${pickupId}`)
      .then((res) => {
        setPickup(res.data);
        setScheduleForm({
          requestedDate: res.data.requestedDate?.slice(0, 10) ?? "",
          requestedSlot: res.data.requestedSlot ?? "",
          assignedDriverId: res.data.assignedDriverId ?? "",
        });
        setDriverForm(res.data.assignedDriverId ?? "");
        setRejectReason("");
      })
      .catch(() => setPickup(null))
      .finally(() => setLoading(false));
  }, [pickupId, open]);

  async function callAction(
    name: string,
    url: string,
    body?: unknown,
    method: "POST" = "POST",
  ) {
    if (!pickup) return;
    setPending(name);
    try {
      const res = await apiFetch<PickupRequestDTO>(url, { method, body });
      setPickup(res.data);
      toast.success(`Berhasil: ${name}`);
      onMutated();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : `Gagal: ${name}`);
    } finally {
      setPending("");
    }
  }

  const status = pickup?.status;
  const dates = nextDates(14);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Detail Pickup
            {status && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${PICKUP_STATUS_BADGE[status]}`}
              >
                {PICKUP_STATUS_LABEL[status]}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !pickup ? (
          <p className="text-sm text-muted-foreground">Permintaan tidak ditemukan.</p>
        ) : (
          <div className="space-y-4">
            {/* Customer */}
            <Section title="Pelanggan">
              <Row icon={<User className="h-4 w-4" />} value={pickup.customerName} />
              <Row
                icon={<Phone className="h-4 w-4" />}
                value={
                  <a
                    href={`https://wa.me/${pickup.customerPhone.replace(/\D/g, "").replace(/^0/, "62")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {pickup.customerPhone}
                  </a>
                }
              />
              {pickup.customerEmail && (
                <Row icon={<Mail className="h-4 w-4" />} value={pickup.customerEmail} />
              )}
            </Section>

            {/* Location */}
            {(pickup.mapsLink || pickup.addressText) && (
              <Section title="Lokasi">
                {pickup.mapsLink && (
                  <a
                    href={pickup.mapsLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka di Google Maps
                  </a>
                )}
                {pickup.addressText && (
                  <Row
                    icon={<MapPin className="h-4 w-4" />}
                    value={
                      <span className="whitespace-pre-wrap">{pickup.addressText}</span>
                    }
                  />
                )}
              </Section>
            )}

            {/* Schedule preview */}
            {(pickup.requestedDate || pickup.requestedSlot) && (
              <Section title="Jadwal Diminta">
                {pickup.requestedDate && (
                  <Row
                    icon={<Calendar className="h-4 w-4" />}
                    value={new Date(pickup.requestedDate).toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  />
                )}
                {pickup.requestedSlot && (
                  <Row icon={<Clock className="h-4 w-4" />} value={pickup.requestedSlot} />
                )}
              </Section>
            )}

            {/* Notes */}
            {pickup.notes && (
              <Section title="Catatan Pelanggan">
                <div className="flex items-start gap-2 text-sm">
                  <FileText className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                  <span className="whitespace-pre-wrap">{pickup.notes}</span>
                </div>
              </Section>
            )}

            {/* Driver */}
            {pickup.assignedDriverId && (
              <Section title="Driver">
                <Row
                  icon={<Truck className="h-4 w-4" />}
                  value={pickup.assignedDriverId}
                />
              </Section>
            )}

            {/* Pengiriman (return delivery leg) — shown when pickup is linked to an order */}
            {pickup.convertedOrderId && (
              <Section title="Pengiriman">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="font-mono text-xs">
                        {pickup.convertedOrderSummary?.orderNumber ?? pickup.convertedOrderId}
                      </span>
                      {pickup.convertedOrderSummary && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                            ORDER_STATUS_CONFIG[pickup.convertedOrderSummary.status]?.color ?? ""
                          }`}
                        >
                          {ORDER_STATUS_LABEL[pickup.convertedOrderSummary.status] ?? pickup.convertedOrderSummary.status}
                        </span>
                      )}
                    </div>
                    {pickup.convertedOrderSummary?.deliveredAt && (
                      <p className="text-xs text-muted-foreground">
                        Terkirim {new Date(pickup.convertedOrderSummary.deliveredAt).toLocaleString("id-ID", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    {!pickup.convertedOrderSummary && (
                      <p className="text-xs text-muted-foreground">Order summary unavailable</p>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={() => router.push(`/laundry/orders/${pickup.convertedOrderId}`)}
                  >
                    <ExternalLink className="mr-1 h-3.5 w-3.5" />
                    Lihat Order
                  </Button>
                </div>
              </Section>
            )}

            {/* ── Schedule form (ACCEPTED only) ── */}
            {status === "ACCEPTED" && (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="mb-2 text-sm font-semibold">Jadwalkan Pickup</p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <div>
                    <Label className="text-xs">Tanggal</Label>
                    <select
                      value={scheduleForm.requestedDate}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, requestedDate: e.target.value })
                      }
                      className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                    >
                      <option value="">Pilih tanggal</option>
                      {dates.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs">Slot</Label>
                    <select
                      value={scheduleForm.requestedSlot}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, requestedSlot: e.target.value })
                      }
                      className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-sm"
                    >
                      <option value="">Pilih slot</option>
                      {DEFAULT_SLOTS.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Input
                  className="mt-2"
                  placeholder="Driver ID (opsional)"
                  value={scheduleForm.assignedDriverId}
                  onChange={(e) =>
                    setScheduleForm({ ...scheduleForm, assignedDriverId: e.target.value })
                  }
                />
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  disabled={
                    pending !== "" ||
                    !scheduleForm.requestedDate ||
                    !scheduleForm.requestedSlot
                  }
                  onClick={() =>
                    callAction("Jadwalkan", `/api/pickup-requests/${pickup.id}/schedule`, {
                      requestedDate: scheduleForm.requestedDate,
                      requestedSlot: scheduleForm.requestedSlot,
                      assignedDriverId: scheduleForm.assignedDriverId || undefined,
                    })
                  }
                >
                  {pending === "Jadwalkan" && (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  )}
                  Jadwalkan
                </Button>
              </div>
            )}

            {/* ── Reject form (PENDING or ACCEPTED) ── */}
            {(status === "PENDING" || status === "ACCEPTED") && (
              <div className="rounded-xl border border-border/60 p-3">
                <p className="mb-2 text-sm font-semibold">Tolak Permintaan</p>
                <Textarea
                  rows={2}
                  placeholder="Alasan penolakan (opsional)"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
                <Button
                  size="sm"
                  variant="destructive"
                  className="mt-2 w-full"
                  disabled={pending !== ""}
                  onClick={() =>
                    callAction("Tolak", `/api/pickup-requests/${pickup.id}/reject`, {
                      reason: rejectReason || undefined,
                    })
                  }
                >
                  {pending === "Tolak" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  <XCircle className="mr-1 h-3 w-3" />
                  Tolak
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {status === "PENDING" && (
            <Button
              disabled={pending !== ""}
              onClick={() => callAction("Terima", `/api/pickup-requests/${pickup!.id}/accept`)}
            >
              {pending === "Terima" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              <CheckCircle2 className="mr-1 h-4 w-4" />
              Terima
            </Button>
          )}
          {status === "SCHEDULED" && (
            <Button
              disabled={pending !== ""}
              onClick={() =>
                callAction("Konversi", `/api/pickup-requests/${pickup!.id}/convert`)
              }
            >
              {pending === "Konversi" && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              <Package className="mr-1 h-4 w-4" />
              Buat Order
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ──

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <span className="flex-1">{value}</span>
    </div>
  );
}
