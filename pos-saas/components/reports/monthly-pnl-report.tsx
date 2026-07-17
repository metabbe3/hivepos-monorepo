"use client";

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageLoading } from "@/components/shared/loading";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch } from "@/modules/shared";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

interface PnlData {
  month: number;
  year: number;
  monthName: string;
  pnl: {
    income: { perKg: number; perItem: number; total: number };
    unpaidBalance: number;
    cashCollected: number;
    cashCollectedByMonth: { month: string; amount: number; isCurrent: boolean }[];
    expenses: { category: string; amount: number }[];
    totalExpenses: number;
    netProfit: number;
    marginPercent: number;
  };
  expenseDetails: { date: string; description: string; amount: number }[];
  dailyTransactions: {
    date: string;
    dayName: string;
    dateNumber: number;
    orders: {
      customerName: string;
      weightKg: number;
      items: { name: string; qty: number }[];
      itemSummary: string;
      amount: number;
    }[];
    dayTotal: number;
    runningTotal: number;
  }[];
  annualComparison: {
    month: number;
    monthName: string;
    revenue: number;
    expenses: number;
    netProfit: number;
  }[];
}

export function MonthlyPnlReport() {
  const { t } = useTranslation();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState<PnlData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
    apiFetch<PnlData>(`/api/reports/monthly-pnl?month=${month}&year=${year}`)
      .then((r) => setData(r.data))
      .catch(() => { setData(null); setError(true); })
      .finally(() => setLoading(false));
  }, [month, year]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch(`/api/reports/monthly-pnl/export?month=${month}&year=${year}`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RL_${MONTH_NAMES[month - 1]}_${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silent
    } finally {
      setExporting(false);
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  if (loading) return <PageLoading />;
  if (error || !data) return <p className="text-center py-12 text-muted-foreground">{t("reports.failedToLoad")}</p>;

  const { pnl, expenseDetails, dailyTransactions, annualComparison } = data;

  const annualTotals = annualComparison.reduce(
    (acc, m) => ({ revenue: acc.revenue + m.revenue, expenses: acc.expenses + m.expenses, netProfit: acc.netProfit + m.netProfit }),
    { revenue: 0, expenses: 0, netProfit: 0 },
  );

  return (
    <div className="space-y-6">
      {/* Header with navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="h-4 w-4" /></Button>
          <h3 className="text-base sm:text-lg font-semibold text-center flex-1 min-w-0">{MONTH_NAMES[month - 1]} {year}</h3>
          <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={exporting} className="w-full sm:w-auto">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {exporting ? "..." : "Export XLSX"}
        </Button>
      </div>

      {/* P&L Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-center text-base">
            LAPORAN RUGI LABA
          </CardTitle>
          <p className="text-center text-sm text-muted-foreground">{data.monthName} {year}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* PEMASUKAN */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide mb-2">Pemasukan</h4>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground pl-4">- Kiloan (Per KG)</span>
                <span className="font-medium">{formatCurrency(pnl.income.perKg)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground pl-4">- Satuan (Per Item)</span>
                <span className="font-medium">{formatCurrency(pnl.income.perItem)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t pt-1">
                <span>Total Pemasukan</span>
                <span>{formatCurrency(pnl.income.total)}</span>
              </div>
            </div>
          </div>

          {/* BELUM DIBAYAR */}
          {pnl.unpaidBalance > 0 && (
            <div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Belum Dibayar</span>
                <span className="font-medium text-orange-600">{formatCurrency(pnl.unpaidBalance)}</span>
              </div>
            </div>
          )}

          {/* KAS MASUK — cash actually received this month (cash-flow memo, NOT income) */}
          <div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                Kas Masuk Bulan Ini
                <span className="ml-1 text-[11px] text-muted-foreground/70">(termasuk pelunasan piutang)</span>
              </span>
              <span className="font-medium text-emerald-600">{formatCurrency(pnl.cashCollected)}</span>
            </div>
            {pnl.cashCollectedByMonth.length > 0 && (
              <div className="mt-1 space-y-0.5 pl-3">
                {pnl.cashCollectedByMonth.map((c) => {
                  const label = c.isCurrent
                    ? "Bulan ini"
                    : `${MONTH_NAMES[parseInt(c.month.slice(5, 7), 10) - 1]} ${c.month.slice(0, 4)}`;
                  return (
                    <div key={c.month} className="flex justify-between text-xs text-muted-foreground">
                      <span>— {label}{!c.isCurrent && " (piutang)"}</span>
                      <span className="tabular-nums">{formatCurrency(c.amount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* PENGELUARAN */}
          <div>
            <h4 className="font-semibold text-sm uppercase tracking-wide mb-2">Pengeluaran</h4>
            <div className="space-y-1">
              {pnl.expenses.map((e, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground pl-4">- {e.category}</span>
                  <span className="font-medium">{formatCurrency(e.amount)}</span>
                </div>
              ))}
              {pnl.expenses.length === 0 && (
                <p className="text-sm text-muted-foreground pl-4">Tidak ada pengeluaran</p>
              )}
              <div className="flex justify-between text-sm font-semibold border-t pt-1">
                <span>Total Pengeluaran</span>
                <span>{formatCurrency(pnl.totalExpenses)}</span>
              </div>
            </div>
          </div>

          {/* LABA / RUGI */}
          <div className="flex justify-between text-base font-bold border-t-2 pt-3">
            <span>LABA / RUGI</span>
            <span className={pnl.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}>
              {formatCurrency(pnl.netProfit)}
            </span>
          </div>
          {pnl.income.total > 0 && (
            <p className="text-xs text-muted-foreground text-right">
              Margin: {pnl.marginPercent}%
            </p>
          )}
        </CardContent>
      </Card>

      {/* Daily Transaction Details */}
      {dailyTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Rincian Transaksi Harian</CardTitle>
            <p className="text-xs text-muted-foreground">{data.monthName} {year} — {dailyTransactions.reduce((s, d) => s + d.orders.length, 0)} pesanan</p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-border bg-muted/40">
                    <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-20">Hari</th>
                    <th className="text-center py-2 px-1 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-8">Tgl</th>
                    <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pelanggan</th>
                    <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-16">KG</th>
                    <th className="text-left py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Satuan</th>
                    <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-28">Jumlah</th>
                    <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-28">Total Hari</th>
                    <th className="text-right py-2 px-2 text-xs uppercase tracking-wider text-muted-foreground font-semibold w-28">Kumulatif</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyTransactions.map((day) =>
                    day.orders.map((order, oi) => {
                      const isFirst = oi === 0;
                      const isLast = oi === day.orders.length - 1;
                      const isEven = oi % 2 === 1;
                      return (
                        <tr
                          key={`${day.date}-${oi}`}
                          className={`
                            ${isFirst ? "border-t-2 border-t-border" : "border-t border-border/40"}
                            ${isLast ? "border-b-2 border-b-border bg-muted/30" : "border-b border-border/40"}
                            ${isEven && !isLast ? "bg-muted/[0.04]" : ""}
                            hover:bg-muted/15 transition-colors
                          `}
                        >
                          <td className={`py-1.5 px-2 ${isFirst ? "text-xs font-bold uppercase tracking-wider text-foreground" : ""}`}>
                            {isFirst ? day.dayName : ""}
                          </td>
                          <td className={`py-1.5 px-1 text-center ${isFirst ? "font-bold text-foreground" : ""}`}>
                            {isFirst ? day.dateNumber : ""}
                          </td>
                          <td className="py-1.5 px-2 font-medium whitespace-nowrap">{order.customerName}</td>
                          <td className={`py-1.5 px-2 text-right tabular-nums ${order.weightKg > 0 ? "text-blue-600 font-medium font-mono" : "text-muted-foreground"}`}>
                            {order.weightKg > 0 ? order.weightKg : ""}
                          </td>
                          <td className={`py-1.5 px-2 ${order.itemSummary ? "text-purple-600" : "text-muted-foreground"}`}>
                            {order.itemSummary || "\u2014"}
                          </td>
                          <td className="py-1.5 px-2 text-right font-medium tabular-nums">{formatCurrency(order.amount)}</td>
                          <td className={`py-1.5 px-2 text-right tabular-nums ${isLast ? "font-semibold text-foreground" : ""}`}>
                            {isLast ? formatCurrency(day.dayTotal) : ""}
                          </td>
                          <td className={`py-1.5 px-2 text-right tabular-nums ${isLast ? "font-bold text-emerald-700" : ""}`}>
                            {isLast ? formatCurrency(day.runningTotal) : ""}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expense Details */}
      {expenseDetails.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Rincian Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Tanggal</th>
                    <th className="text-left py-2 font-medium">Keterangan</th>
                    <th className="text-right py-2 font-medium">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {expenseDetails.map((e, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 text-muted-foreground">{e.date.slice(5)}</td>
                      <td className="py-1.5">{e.description}</td>
                      <td className="py-1.5 text-right">{formatCurrency(e.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Annual Comparison */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Perbandingan Bulanan {year}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 font-medium">Bulan</th>
                  <th className="text-right py-2 font-medium">Pendapatan</th>
                  <th className="text-right py-2 font-medium">Pengeluaran</th>
                  <th className="text-right py-2 font-medium">Laba/Rugi</th>
                </tr>
              </thead>
              <tbody>
                {annualComparison.map((m) => (
                  <tr key={m.month} className={`border-b last:border-0 ${m.month === month ? "bg-muted/50" : ""}`}>
                    <td className="py-1.5 font-medium">{m.monthName}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.revenue)}</td>
                    <td className="py-1.5 text-right">{formatCurrency(m.expenses)}</td>
                    <td className={`py-1.5 text-right font-medium ${m.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {formatCurrency(m.netProfit)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 font-bold">
                  <td className="py-2">TOTAL</td>
                  <td className="py-2 text-right">{formatCurrency(annualTotals.revenue)}</td>
                  <td className="py-2 text-right">{formatCurrency(annualTotals.expenses)}</td>
                  <td className={`py-2 text-right ${annualTotals.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(annualTotals.netProfit)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
