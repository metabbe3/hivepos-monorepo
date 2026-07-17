"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  DollarSign,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Package,
  Users,
  Sparkles,
  HandCoins,
  AlertTriangle,
  Clock,
  Download,
  Loader2,
  FileSpreadsheet,
  type LucideIcon,
} from "lucide-react";
import { useGuardedPage } from "@/hooks/use-guarded-page";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { getDateRangePreset } from "@/lib/constants";
import { exportAllToXlsx } from "@/lib/export-utils";
import { toast } from "sonner";

// ponytail: dynamic chunks per tab — visiting /reporting only loads the
// active tab's report. Switching tabs fetches that report on demand.
// Each loader adapts the named export to the `default` next/dynamic expects.
const loadingFallback = (
  <div className="flex items-center justify-center py-20">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);
const dyn = (loader: () => Promise<{ default: React.ComponentType<any> }>) =>
  dynamic(loader, { loading: () => loadingFallback, ssr: false });

const RevenueReport = dyn(() => import("@/components/reports/revenue-report").then(m => ({ default: m.RevenueReport })));
const OrdersReport = dyn(() => import("@/components/reports/orders-report").then(m => ({ default: m.OrdersReport })));
const CustomersReport = dyn(() => import("@/components/reports/customers-report").then(m => ({ default: m.CustomersReport })));
const ServicesReport = dyn(() => import("@/components/reports/services-report").then(m => ({ default: m.ServicesReport })));
const CommissionReport = dyn(() => import("@/components/reports/commission-report").then(m => ({ default: m.CommissionReport })));
const ExpensesReport = dyn(() => import("@/components/reports/expenses-report").then(m => ({ default: m.ExpensesReport })));
const ProfitReport = dyn(() => import("@/components/reports/profit-report").then(m => ({ default: m.ProfitReport })));
const InventoryReport = dyn(() => import("@/components/reports/inventory-report").then(m => ({ default: m.InventoryReport })));
const MonthlyPnlReport = dyn(() => import("@/components/reports/monthly-pnl-report").then(m => ({ default: m.MonthlyPnlReport })));
const PiutangTrackerReport = dyn(() => import("@/components/reports/piutang-tracker-report").then(m => ({ default: m.PiutangTrackerReport })));
const AttendanceReport = dyn(() => import("@/components/reports/attendance-report").then(m => ({ default: m.AttendanceReport })));

interface TabItem {
  value: string;
  label: string;
  icon: LucideIcon;
}

export default function ReportingPage() {
  const { shouldRender } = useGuardedPage("reports", "read", "/laundry/orders");
  const { t } = useTranslation();
  const attendanceOn = useFeatureFlag("staffAttendance");

  const thisMonth = getDateRangePreset("thisMonth");
  const [from, setFrom] = useState(thisMonth.from);
  const [to, setTo] = useState(thisMonth.to);
  const [activeTab, setActiveTab] = useState("revenue");
  const [exporting, setExporting] = useState(false);

  if (!shouldRender) return null;

  const tabItems: TabItem[] = [
    { value: "revenue", label: t("reporting.revenue"), icon: DollarSign },
    { value: "orders", label: t("reporting.orders"), icon: ShoppingCart },
    { value: "expenses", label: t("reporting.expenses"), icon: TrendingDown },
    { value: "profit", label: t("reporting.profit"), icon: TrendingUp },
    { value: "inventory", label: t("reporting.inventory"), icon: Package },
    { value: "customers", label: t("reporting.customers"), icon: Users },
    { value: "services", label: t("reporting.services"), icon: Sparkles },
    { value: "commission", label: t("reporting.commission"), icon: HandCoins },
    { value: "piutang", label: t("reporting.outstanding"), icon: Clock },
    { value: "monthlyPnl", label: t("reporting.monthlyPnl"), icon: FileSpreadsheet },
    ...(attendanceOn ? [{ value: "attendance", label: t("attendance.report"), icon: Clock }] : []),
  ];

  async function handleExportAll() {
    setExporting(true);
    try {
      await exportAllToXlsx(from, to, t);
      toast.success(t("reporting.exportDone"));
    } catch {
      toast.error(t("reporting.exportFailed"));
    } finally {
      setExporting(false);
    }
  }

  // Piutang & Laporan Bulanan ignore the shared from/to range (Piutang lists all
  // outstanding; Laporan Bulanan has its own month nav + its own export), so the
  // date filter AND the Export All button (which exports from/to-range reports)
  // are irrelevant there — hide the whole Filter+Export bar on those two tabs.
  const showFilterBar = activeTab !== "piutang" && activeTab !== "monthlyPnl";

  return (
    <div className="space-y-6">
      <PageHeader title={t("reporting.title")} description={t("reporting.description")} />

      {/* Sub-navigation tabs */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex overflow-x-auto gap-1 p-1 bg-muted rounded-lg scrollbar-none">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(tab.value)}
                  className={`shrink-0 flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
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
        </div>
      </div>

      {/* Filter + Export — hidden on tabs that ignore the from/to range */}
      {showFilterBar && (
        <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <DateRangePicker from={from} to={to} onFromChange={setFrom} onToChange={setTo} />
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={exporting}
              className="w-full sm:w-auto shrink-0"
            >
              {exporting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {exporting ? t("common.saving") : t("reporting.exportAll")}
            </Button>
          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsContent value="revenue">
          <RevenueReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="orders">
          <OrdersReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="expenses">
          <ExpensesReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="profit">
          <ProfitReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomersReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="services">
          <ServicesReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="commission">
          <CommissionReport from={from} to={to} />
        </TabsContent>
        <TabsContent value="monthlyPnl">
          <MonthlyPnlReport />
        </TabsContent>
        <TabsContent value="piutang">
          <PiutangTrackerReport />
        </TabsContent>
        {attendanceOn ? (
          <TabsContent value="attendance">
            <AttendanceReport from={from} to={to} />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
