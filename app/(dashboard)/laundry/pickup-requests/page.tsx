"use client";

import { useEffect, useState, useCallback } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Phone,
  MapPin,
  Calendar,
  Clock,
  List,
  CheckCircle2,
  XCircle,
  Package,
  Truck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { apiFetch } from "@/modules/shared";
import { formatDateTime } from "@/lib/format";
import { PickupRequestDetailDialog } from "@/components/dashboard/pickup-request-detail-dialog";
import { PickupCreateDialog } from "@/components/dashboard/pickup-create-dialog";
import {
  PICKUP_STATUS_BADGE,
  PICKUP_STATUS_LABEL,
} from "@/modules/pickup-requests/ui/status-styles";
import type { PickupRequestDTO } from "@/modules/pickup-requests/application/dto";

type PickupStatus =
  | "PENDING"
  | "ACCEPTED"
  | "SCHEDULED"
  | "CONVERTED"
  | "REJECTED"
  | "CANCELED";

const STATUS_TABS: { value: PickupStatus | "ALL"; label: string; icon: any }[] = [
  { value: "ALL", label: "Semua", icon: List },
  { value: "PENDING", label: "Menunggu", icon: Clock },
  { value: "ACCEPTED", label: "Diterima", icon: CheckCircle2 },
  { value: "SCHEDULED", label: "Dijadwalkan", icon: Calendar },
  { value: "CONVERTED", label: "Jadi Order", icon: Package },
  { value: "REJECTED", label: "Ditolak", icon: XCircle },
];

export default function PickupRequestsPage() {
  const [pickups, setPickups] = useState<PickupRequestDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [status, setStatus] = useState<PickupStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchPickups = useCallback(() => {
    const params = new URLSearchParams();
    if (status !== "ALL") params.set("status", status);
    if (debouncedSearch) params.set("search", debouncedSearch);
    params.set("page", String(page));
    params.set("limit", "20");
    apiFetch<PickupRequestDTO[]>(`/api/pickup-requests?${params}`)
      .then((res) => {
        setPickups(res.data || []);
        setTotalPages(res.meta?.totalPages ?? 1);
      })
      .catch(() => setPickups([]))
      .finally(() => setLoading(false));
  }, [status, debouncedSearch, page]);

  useEffect(() => {
    fetchPickups();
  }, [fetchPickups]);

  useEffect(() => {
    setPage(1);
  }, [status, debouncedSearch]);

  function openDetail(id: string) {
    setDetailId(id);
    setDetailOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pickup Requests"
        description="Kelola permintaan antar-jemput laundry dari pelanggan."
        action={{ label: "Buat Pickup", onClick: () => setCreateOpen(true) }}
      />

      {/* Status Tabs + Search */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 scrollbar-none">
          {STATUS_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = status === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatus(tab.value)}
                className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
        <div className="relative w-full flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama / telepon..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border/60 pl-9"
          />
        </div>
      </div>

      {/* List */}
      {loading ? (
        <PageLoading />
      ) : pickups.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={
            search || status !== "ALL"
              ? "Tidak ada permintaan yang cocok"
              : "Belum ada permintaan pickup"
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {pickups.map((p) => (
              <Card
                key={p.id}
                onClick={() => openDetail(p.id)}
                className="cursor-pointer rounded-xl border border-border/40 bg-card shadow-sm transition-shadow hover:shadow-md"
              >
                <CardContent className="py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{p.customerName}</span>
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${
                            PICKUP_STATUS_BADGE[p.status]
                          }`}
                        >
                          {PICKUP_STATUS_LABEL[p.status]}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />
                        <span className="truncate">{p.customerPhone}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDateTime(p.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {p.requestedSlot && (
                        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {p.requestedSlot}
                        </div>
                      )}
                      {p.addressText && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="max-w-[10rem] truncate">{p.addressText}</span>
                        </div>
                      )}
                      {p.assignedDriverId && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                          <Truck className="h-3 w-3" />
                          <span className="max-w-[10rem] truncate font-mono">
                            {p.assignedDriverId}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 border-t border-border/40 pt-4">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <span className="text-sm text-muted-foreground">
                Hal. {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </>
      )}

      <PickupRequestDetailDialog
        pickupId={detailId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onMutated={fetchPickups}
      />

      <PickupCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={fetchPickups}
      />
    </div>
  );
}
