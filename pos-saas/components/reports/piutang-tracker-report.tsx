"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/modules/shared";
import { formatCurrency } from "@/lib/format";
import Link from "next/link";
import { Loader2, AlertTriangle, Wallet, FileText, Inbox, ChevronDown, ChevronRight } from "lucide-react";

interface Payment { amount: number; paidAt: string; method: string }
interface OrderRow {
  id: string;
  orderNumber: string; customer: string; createdAt: string;
  totalAmount: number; paidAmount: number; outstanding: number;
  ageDays: number; bucket: string; status: string; payments: Payment[];
}
interface Report {
  monthlySummary: Array<{ month: string; newOrders: number; newPiutang: number; paidSoFar: number; stillOutstanding: number; fullyPaidCount: number }>;
  agingBuckets: Record<string, { amount: number; count: number }>;
  totalOutstanding: number;
  outstandingOrderCount: number;
  orders: OrderRow[];
}

const MONTHS_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];

const AGING_STYLE: Record<string, string> = {
  "0-30": "border-emerald-300",
  "31-60": "border-amber-300",
  "61-90": "border-orange-300",
  "90+": "border-red-300",
};

function PiutangContent() {
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    apiFetch<Report>("/api/reports/piutang-tracker")
      .then((r) => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const customerSummary = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { name: string; outstanding: number; count: number }>();
    for (const o of data.orders) {
      if (o.status === "PAID" || o.outstanding <= 0) continue;
      const e = map.get(o.customer) || { name: o.customer, outstanding: 0, count: 0 };
      e.outstanding += o.outstanding;
      e.count++;
      map.set(o.customer, e);
    }
    return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
  }, [data]);

  // Unpaid orders only, grouped by creation month — the Piutang tab is a
  // collections to-do list (who still owes). Paid/collection history lives in
  // Laporan Bulanan's "Kas Masuk". A month with Rp 0 outstanding won't appear.
  const unpaidByMonth = useMemo(() => {
    if (!data) return {} as Record<string, OrderRow[]>;
    const map: Record<string, OrderRow[]> = {};
    for (const o of data.orders) {
      if (o.status === "PAID" || o.outstanding <= 0) continue;
      const month = o.createdAt.slice(0, 7);
      if (!map[month]) map[month] = [];
      map[month].push(o);
    }
    for (const k of Object.keys(map)) {
      map[k].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    }
    return map;
  }, [data]);

  // Group months under year headers (years descending; months within a year
  // descending) so the list stays navigable across a year boundary (Dec→Jan).
  const yearGroups = useMemo(() => {
    const byYear = new Map<string, string[]>();
    for (const m of Object.keys(unpaidByMonth).sort((a, b) => b.localeCompare(a))) {
      const y = m.slice(0, 4);
      if (!byYear.has(y)) byYear.set(y, []);
      byYear.get(y)!.push(m);
    }
    return Array.from(byYear.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([year, months]) => ({ year, months }));
  }, [unpaidByMonth]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-center">
        <Inbox className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-medium">Belum ada data piutang.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-muted-foreground">Total Piutang</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums text-red-600">{formatCurrency(data.totalOutstanding)}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Order Belum Lunas</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{data.outstandingOrderCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">Pelanggan Piutang</span>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums">{customerSummary.length}</p>
        </div>
      </div>

      {/* Aging buckets */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Umur Piutang</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["0-30", "31-60", "61-90", "90+"].map((b) => {
            const d = data.agingBuckets[b] || { amount: 0, count: 0 };
            const isUrgent = b === "90+" && d.amount > 0;
            const agingClass = "rounded-xl border-2 p-4 " + (AGING_STYLE[b] || "") + (isUrgent ? " bg-red-50" : "");
            return (
              <div key={b} className={agingClass}>
                <p className="text-xs text-muted-foreground">{b === "90+" ? "90+ hari" : b + " hari"}</p>
                <p className={"mt-1 text-lg font-bold tabular-nums" + (isUrgent ? " text-red-600" : "")}>{formatCurrency(d.amount)}</p>
                <p className="text-xs text-muted-foreground">{d.count} order</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per customer */}
      {customerSummary.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold">Per Pelanggan</h3>
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Pelanggan</th>
                  <th className="px-4 py-3 text-right">Piutang</th>
                  <th className="px-4 py-3 text-right">Order</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {customerSummary.slice(0, 10).map((c) => (
                  <tr key={c.name}>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-red-600">{formatCurrency(c.outstanding)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Piutang Belum Dibayar per Bulan — hanya order belum lunas, dikelompokkan per tahun */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Piutang Belum Dibayar per Bulan</h3>
        {yearGroups.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <Inbox className="h-8 w-8 text-emerald-500" />
            <p className="text-sm font-medium text-emerald-600">Semua piutang sudah lunas!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {yearGroups.map(({ year, months }) => (
              <div key={year} className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{year}</h4>
                <div className="space-y-4">
                  {months.map((month) => {
                    const orders = unpaidByMonth[month];
                    const totalMonth = orders.reduce((s, o) => s + o.outstanding, 0);
                    return (
                      <div key={month} className="overflow-hidden rounded-xl border">
                        <button
                          type="button"
                          onClick={() => setExpandedMonth(expandedMonth === month ? null : month)}
                          className="flex w-full items-center justify-between bg-muted/50 px-5 py-3 text-left cursor-pointer hover:bg-muted/70 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            {expandedMonth === month ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                            <span className="font-semibold">{MONTHS_ID[parseInt(month.slice(5, 7), 10) - 1]}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{orders.length} order belum lunas</span>
                          </div>
                          <span className="font-bold text-red-600 tabular-nums">{formatCurrency(totalMonth)}</span>
                        </button>
                        {expandedMonth === month && (
                          <div className="divide-y">
                            {orders.map((o) => (
                              <Link key={o.orderNumber} href={"/laundry/orders/" + o.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm hover:bg-muted/30 cursor-pointer transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-mono text-xs text-muted-foreground shrink-0">{o.createdAt}</span>
                                  <span className="font-mono text-xs text-muted-foreground shrink-0">{o.orderNumber}</span>
                                  <span className="font-medium truncate">{o.customer}</span>
                                  <span className={"shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold " + (o.status === "PARTIAL" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700")}>
                                    {o.status === "PARTIAL" ? "Sebagian" : "Belum"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0 text-right">
                                  <span className="text-xs text-muted-foreground tabular-nums">{o.ageDays}h</span>
                                  <span className="font-semibold text-red-600 tabular-nums">{formatCurrency(o.outstanding)}</span>
                                </div>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function PiutangTrackerReport() {
  return (
    <Suspense>
      <PiutangContent />
    </Suspense>
  );
}
