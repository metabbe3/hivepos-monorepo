"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  CheckCircle, Clock, Package, ShoppingBag, Sparkles,
  MapPin, Phone, ArrowLeft, Receipt, CreditCard, ExternalLink,
  ChevronDown, ChevronUp, Shirt, QrCode, MessageCircle
} from "lucide-react";
import { ORDER_STATUS_CONFIG, BUSINESS_NAME_KEY } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import { WhatsAppFAB } from "@/components/public/whatsapp-fab";
import { appendWhatsappMessage } from "@/lib/whatsapp";
import { renderWhatsAppTemplate, type TemplateOverrides } from "@/lib/whatsapp-templates";
import { apiFetch, ApiClientError } from "@/modules/shared";
import type { OrderStatus } from "@/app/generated/prisma/enums";
import { TrackPhotosSection } from "@/components/photos/track-photos-section";

interface TrackingItem {
  service: string;
  pricingType: string;
  quantity: number;
  weightKg: number | null;
  pricePerUnit: number;
  subtotal: number;
  garmentBreakdown: { name: string; qty: number }[] | null;
  photoUrl?: string | null;
}

interface PaymentInfo {
  amount: number;
  method: string;
  paidAt: string;
}

interface TrackingData {
  orderNumber: string;
  status: OrderStatus;
  statusLabel: string;
  paymentStatus: string;
  paymentStatusLabel: string;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  notes: string | null;
  createdAt: string;
  receivedAt: string | null;
  inProgressAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  items: TrackingItem[];
  payments: PaymentInfo[];
  branch: {
    name: string;
    phone: string | null;
    whatsappLink: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    invoiceFooter: string | null;
  };
  qrisImageUrl: string | null;
  whatsappTemplates: TemplateOverrides | null;
}

const STEPS: { key: OrderStatus; label: string; icon: typeof ShoppingBag; desc: string }[] = [
  { key: "RECEIVED", label: "Diterima", icon: ShoppingBag, desc: "Pesanan sudah diterima oleh laundry" },
  { key: "IN_PROGRESS", label: "Sedang Diproses", icon: Sparkles, desc: "Barang sedang dicuci / disetrika" },
  { key: "READY", label: "Siap Diambil", icon: Package, desc: "Barang sudah selesai, bisa diambil" },
  { key: "DELIVERED", label: "Selesai", icon: CheckCircle, desc: "Barang sudah diambil oleh pelanggan" },
];

function getTimestamp(data: TrackingData, status: OrderStatus): string | null {
  switch (status) {
    case "RECEIVED": return data.receivedAt || data.createdAt;
    case "IN_PROGRESS": return data.inProgressAt;
    case "READY": return data.readyAt;
    case "DELIVERED": return data.deliveredAt;
    default: return null;
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

function formatShortCurrency(amount: number) {
  if (amount >= 1000000) return `Rp ${(amount / 1000000).toFixed(1)}jt`;
  if (amount >= 1000) return `Rp ${(amount / 1000).toFixed(0)}rb`;
  return `Rp ${amount}`;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Tunai",
  QRIS: "QRIS",
  TRANSFER: "Transfer",
  DEPOSIT: "Deposit",
};

// Confetti burst — pure CSS, no deps
function ConfettiBurst() {
  const colors = ["#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899"];
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {Array.from({ length: 40 }).map((_, i) => {
        const color = colors[i % colors.length];
        const left = Math.random() * 100;
        const delay = Math.random() * 0.8;
        const duration = 1.5 + Math.random() * 1.5;
        const size = 6 + Math.random() * 8;
        const drift = -40 + Math.random() * 80;
        const rotation = Math.random() * 360;
        return (
          <span
            key={i}
            className="absolute top-0 opacity-0"
            style={{
              left: `${left}%`,
              width: `${size}px`,
              height: `${size * 0.6}px`,
              backgroundColor: color,
              borderRadius: Math.random() > 0.5 ? "50%" : "2px",
              transform: `rotate(${rotation}deg)`,
              animation: `confetti-fall ${duration}s ease-out ${delay}s forwards`,
              ["--drift" as string]: `${drift}px`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0% { opacity: 1; transform: translateY(-20px) translateX(0) rotate(0deg); }
          100% { opacity: 0; transform: translateY(100vh) translateX(var(--drift)) rotate(720deg); }
        }
      `}</style>
    </div>
  );
}

// Expandable item card with garment breakdown + optional photo
function ItemCard({ item }: { item: TrackingItem }) {
  const [expanded, setExpanded] = useState(true); // default expanded to show details
  const hasBreakdown = item.garmentBreakdown && item.garmentBreakdown.length > 0;
  const totalPieces = hasBreakdown ? item.garmentBreakdown!.reduce((s, g) => s + g.qty, 0) : item.quantity;
  const hasPhoto = !!item.photoUrl;

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      {/* Photo — if available */}
      {hasPhoto && (
        <div className="px-4 pt-3.5">
          <img
            src={item.photoUrl!}
            alt={item.service}
            className="w-full h-40 object-cover rounded-lg bg-slate-100"
            loading="lazy"
          />
        </div>
      )}
      {/* Item header — always visible */}
      <button
        onClick={() => hasBreakdown ? setExpanded(!expanded) : null}
        className={`w-full text-left px-4 py-3.5 flex items-center gap-3 ${hasBreakdown ? "cursor-pointer" : "cursor-default"} ${hasPhoto ? "pt-2.5" : ""}`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0">
          <Shirt className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-sm text-slate-900 truncate">{item.service}</p>
            <p className="font-bold text-sm text-slate-900 shrink-0">{formatCurrency(item.subtotal)}</p>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {item.pricingType === "PER_KG" && item.weightKg
              ? `${item.weightKg} kg × ${formatCurrency(item.pricePerUnit)}/kg`
              : `${item.quantity} × ${formatCurrency(item.pricePerUnit)}`
            }
          </p>
        </div>
        {hasBreakdown && (
          <div className={`text-slate-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>
            <ChevronDown className="h-4 w-4" />
          </div>
        )}
      </button>

      {/* Garment breakdown — expandable */}
      {hasBreakdown && expanded && (
        <div className="px-4 pb-3.5 -mt-1">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Detail Item</p>
              <p className="text-xs font-semibold text-brand-700">{totalPieces} potong</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {item.garmentBreakdown!.map((g, j) => (
                <div key={j} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{g.name}</span>
                  <span className="font-semibold text-slate-900 tabular-nums">{g.qty}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TrackOrderPage() {
  const params = useParams();
  const orderNumber = params.orderNumber as string;
  const { t } = useTranslation();
  const [data, setData] = useState<TrackingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<TrackingData>(`/api/track/${orderNumber}`)
      .then((r) => setData(r.data))
      .catch((err) => {
        setError(err instanceof ApiClientError ? err.message : t("tracking.failedToLoad"));
      });
  }, [orderNumber, t]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mx-auto">
            <Package className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="font-serif text-xl font-extrabold tracking-tight text-slate-900">Pesanan Tidak Ditemukan</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <Link href="/" className="text-sm text-brand-700 hover:underline font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded">Kembali ke Beranda</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 space-y-4">
          <div className="h-7 w-40 rounded-md bg-slate-200 animate-pulse" />
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/60 p-5 space-y-4">
              <div className="h-5 w-32 rounded bg-slate-200 animate-pulse" />
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 flex-1 rounded-full bg-slate-200 animate-pulse" />
                ))}
              </div>
              <div className="h-20 rounded-xl bg-slate-200/60 animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-slate-200/60 animate-pulse" />
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-slate-200/60 p-5 space-y-3">
                  <div className="h-5 w-24 rounded bg-slate-200 animate-pulse" />
                  <div className="h-32 rounded-xl bg-slate-200/60 animate-pulse" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = STEPS.findIndex((s) => s.key === data.status);
  const totalAfterDiscount = data.totalAmount - data.discountAmount;
  const remaining = totalAfterDiscount - data.paidAmount;
  const hasMapCoords = data.branch.latitude != null && data.branch.longitude != null;
  const mapsUrl = hasMapCoords
    ? `https://www.google.com/maps?q=${data.branch.latitude},${data.branch.longitude}`
    : data.branch.address
      ? `https://www.google.com/maps/search/${encodeURIComponent(data.branch.address)}`
      : null;

  // Count total pieces across all items
  const totalPieces = data.items.reduce((sum, item) => {
    if (item.garmentBreakdown && item.garmentBreakdown.length > 0) {
      return sum + item.garmentBreakdown.reduce((s, g) => s + g.qty, 0);
    }
    return sum + item.quantity;
  }, 0);

  const totalWeight = data.items.reduce((sum, item) => sum + (item.weightKg || 0), 0);

  // Status colors for visual variety
  const STATUS_COLORS: Record<string, { bg: string; ring: string; line: string; text: string }> = {
    RECEIVED:    { bg: "bg-blue-500",      ring: "ring-blue-500/20",   line: "bg-blue-400",   text: "text-blue-500" },
    IN_PROGRESS: { bg: "bg-amber-500",     ring: "ring-amber-500/20",  line: "bg-amber-400",  text: "text-amber-500" },
    READY:       { bg: "bg-emerald-500",   ring: "ring-emerald-500/20",line: "bg-emerald-400", text: "text-emerald-500" },
    DELIVERED:   { bg: "bg-purple-500",    ring: "ring-purple-500/20", line: "bg-purple-400",  text: "text-purple-500" },
  };
  const statusColor = STATUS_COLORS[data.status] || STATUS_COLORS.RECEIVED;

  return (
    <div className="min-h-screen bg-slate-50">
      {data.status === "DELIVERED" && <ConfettiBurst />}
      <div className="mx-auto max-w-md pb-8">

        {/* Hero Header */}
        <div className="relative bg-gradient-to-br from-brand to-amber-600 p-6 pb-10 text-white overflow-hidden">
          {/* Decorative circles */}
          <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full bg-white/10" />
          <div className="absolute bottom-4 -left-6 h-20 w-20 rounded-full bg-white/5" />

          <div className="relative">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                  <ShoppingBag className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h1 className="font-serif text-base font-bold leading-tight">{data.branch.name || t(BUSINESS_NAME_KEY)}</h1>
                  <p className="text-xs opacity-70">Lacak Pesanan</p>
                </div>
              </div>
              {/* Current status pill */}
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold backdrop-blur-sm bg-white/20 text-white`}>
                {STEPS[currentIdx]?.label ?? "Unknown"}
              </span>
            </div>

            <div className="rounded-xl bg-white/15 p-4 backdrop-blur-sm">
              <p className="text-[11px] opacity-60 uppercase tracking-wider mb-0.5">Nomor Pesanan</p>
              <p className="text-xl font-bold tracking-wide">{data.orderNumber}</p>
              <div className="flex items-center gap-3 mt-2 text-sm opacity-80">
                <span>{data.customerName}</span>
                <span className="opacity-40">•</span>
                <span>{formatTime(data.createdAt)}</span>
              </div>
              {data.branch.whatsappLink && (
                <a
                  href={appendWhatsappMessage(
                    data.branch.whatsappLink,
                    renderWhatsAppTemplate(
                      "track.customerInquiry",
                      {
                        branchName: data.branch.name,
                        orderNumber: data.orderNumber,
                        currentStatus: STEPS[currentIdx]?.label ?? data.status,
                        trackingUrl: typeof window !== "undefined" ? window.location.href : "",
                      },
                      data.whatsappTemplates ?? undefined,
                    ),
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/25 backdrop-blur-sm px-4 py-2 text-xs font-bold text-white hover:bg-white/35 transition-colors"
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Tanya Status via WhatsApp
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="px-4 mt-5 space-y-5">

          {/* Progress Timeline */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
            <div className="space-y-0">
              {STEPS.map((step, idx) => {
                const isComplete = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const timestamp = getTimestamp(data, step.key);
                const isLast = idx === STEPS.length - 1;
                const Icon = step.icon;
                const stepColor = STATUS_COLORS[step.key] || STATUS_COLORS.RECEIVED;

                return (
                  <div key={step.key} className="flex gap-3.5">
                    <div className="flex flex-col items-center">
                      {isComplete ? (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${stepColor.bg} text-white shrink-0`}>
                          <CheckCircle className="h-4 w-4" />
                        </div>
                      ) : isCurrent ? (
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${statusColor.bg} text-white shrink-0 ring-4 ${statusColor.ring} animate-pulse`}>
                          <Icon className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400 shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                      )}
                      {!isLast && (
                        <div className={`w-0.5 flex-1 min-h-[32px] ${idx < currentIdx ? (idx === currentIdx - 1 ? statusColor.line + "/60" : stepColor.line + "/40") : "bg-slate-200"}`} />
                      )}
                    </div>
                    <div className={`pb-4 ${isLast ? "pb-0" : ""} pt-1`}>
                      <p className={`text-sm font-semibold ${isCurrent ? statusColor.text : isComplete ? "text-slate-900" : "text-slate-400"}`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${isCurrent || isComplete ? "text-slate-500" : "text-slate-400"}`}>
                        {isCurrent ? step.desc : timestamp ? formatTime(timestamp) : "Menunggu"}
                      </p>
                      {isCurrent && timestamp && (
                        <p className="text-xs text-slate-400 mt-0.5">{formatTime(timestamp)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Proof photos (Pro feature) — before/after gallery, read-only */}
          <TrackPhotosSection orderNumber={data.orderNumber} />

          {/* Order Summary Card — quick stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Ringkasan Pesanan</h2>
            <div className="grid grid-cols-2 gap-3">
              {totalWeight > 0 && (
                <div className="rounded-xl bg-slate-50 p-3 text-center">
                  <p className="text-lg font-bold text-slate-900">{totalWeight}</p>
                  <p className="text-[11px] text-slate-500 font-medium">Kg</p>
                </div>
              )}
              <div className="rounded-xl bg-slate-50 p-3 text-center">
                <p className="text-lg font-bold text-slate-900">{totalPieces || data.items.length}</p>
                <p className="text-[11px] text-slate-500 font-medium">{totalPieces > 0 ? "Potong" : "Layanan"}</p>
              </div>
            </div>
          </div>

          {/* Items Card — with expandable garment breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Detail Layanan</h2>
            <div className="space-y-2.5">
              {data.items.map((item, i) => (
                <ItemCard key={i} item={item} />
              ))}
            </div>
          </div>

          {/* Payment Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-bold text-slate-900">Pembayaran</h2>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                data.paymentStatus === "PAID"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : data.paymentStatus === "PARTIAL"
                    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                    : "bg-red-50 text-red-600 ring-1 ring-red-200"
              }`}>
                <CreditCard className="h-3.5 w-3.5" />
                {data.paymentStatus === "PAID" ? "Lunas" : data.paymentStatus === "PARTIAL" ? "Sebagian" : "Belum Bayar"}
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900 tabular-nums">{formatCurrency(data.totalAmount)}</span>
              </div>
              {data.discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Diskon</span>
                  <span className="font-medium text-emerald-600 tabular-nums">−{formatCurrency(data.discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm pt-2.5 border-t border-slate-100">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(totalAfterDiscount)}</span>
              </div>
              {data.paidAmount > 0 && (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Dibayar</span>
                    <span className="font-semibold text-emerald-600 tabular-nums">{formatCurrency(data.paidAmount)}</span>
                  </div>
                  {remaining > 0 && (
                    <div className="flex justify-between text-sm pt-2.5 border-t border-dashed border-slate-200">
                      <span className="font-bold text-slate-900">Sisa</span>
                      <span className="font-bold text-red-600 tabular-nums">{formatCurrency(remaining)}</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {data.payments.length > 0 && (
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Riwayat</p>
                <div className="space-y-2">
                  {data.payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md px-2 py-0.5 bg-slate-100 text-slate-700 text-xs font-medium">
                          {METHOD_LABELS[p.method] || p.method}
                        </span>
                        <span className="text-xs text-slate-400">{new Date(p.paidAt).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}</span>
                      </div>
                      <span className="font-semibold text-slate-900 tabular-nums">{formatCurrency(p.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Branch Info — with map */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-3">Lokasi</h2>
            {/* Map embed */}
            {hasMapCoords && (
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-slate-100 mb-4">
                <iframe
                  src={`https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3966.755616393449!2d${data.branch.longitude}!3d${data.branch.latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x2e69f5b83a2e5b75%3A0x97f19aa449e30f53!2sKera%20Sakti%20Toko!5e0!3m2!1sen!2sid!4v1779580909387!5m2!1sen!2sid`}
                  style={{ border: 0 }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Lokasi Laundry"
                  className="h-full w-full"
                />
              </div>
            )}
            {data.branch.address && (
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0 mt-0.5">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700 leading-relaxed">{data.branch.address}</p>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline font-bold mt-1.5 cursor-pointer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Buka di Google Maps
                    </a>
                  )}
                </div>
              </div>
            )}
            {data.branch.phone && (
              <div className="flex items-center gap-2.5 mt-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/10 text-brand shrink-0">
                  <Phone className="h-4 w-4" />
                </div>
                <a href={`tel:${data.branch.phone}`} className="text-sm text-brand-700 hover:underline font-bold cursor-pointer">{data.branch.phone}</a>
              </div>
            )}
          </div>

          {/* QRIS — only render if tenant has set a QRIS image URL */}
          {data.qrisImageUrl && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
              <div className="flex items-center gap-2 mb-3">
                <QrCode className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-bold text-slate-900">Bayar via QRIS</h2>
              </div>
              <div className="flex flex-col items-center gap-2">
                <img src={data.qrisImageUrl} alt="QRIS" className="max-w-[200px] w-full h-auto rounded-xl" />
                <p className="text-xs text-slate-500 text-center">Scan QR code di atas untuk membayar</p>
              </div>
            </div>
          )}

          {/* Order notes */}
          {data.notes && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200/60 p-4">
              <p className="text-xs font-bold text-amber-800 uppercase tracking-wide mb-1">Catatan</p>
              <p className="text-sm text-amber-900">{data.notes}</p>
            </div>
          )}

          {/* Branch terms / refund policy */}
          {data.branch.invoiceFooter && (
            <div className="bg-slate-50 rounded-2xl border border-slate-200/60 p-4">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-1.5">Ketentuan</p>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{data.branch.invoiceFooter}</p>
            </div>
          )}

          {/* Footer */}
          <div className="text-center pt-1 pb-4 space-y-2">
            <p className="text-xs text-slate-400">
              Dibuat {new Date(data.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
            </p>
            <Link href="/" className="inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded font-medium">
              <ArrowLeft className="h-3 w-3" />
              Kembali ke Beranda
            </Link>
          </div>
        </div>
      </div>
      <WhatsAppFAB />
    </div>
  );
}
