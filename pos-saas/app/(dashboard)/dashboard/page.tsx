"use client";

import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useRole } from "@/hooks/use-role";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { Button } from "@/components/ui/button";
import { RefreshCw, Calendar, Activity, Wallet, Users, Sparkles } from "lucide-react";
import { DashboardSkeleton } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

import { StatsCards } from "@/components/dashboard/stats-cards";
import { CashFlowCard } from "@/components/dashboard/cash-flow-card";
import { KanbanBoard } from "@/components/dashboard/kanban-board";
import { SLATracker } from "@/components/dashboard/sla-tracker";
import { UnpaidOrdersCard } from "@/components/dashboard/unpaid-orders-card";
import { OrderPipelineCard } from "@/components/dashboard/order-pipeline-card";
import { PaymentMethodsCard } from "@/components/dashboard/payment-methods-card";
import { RecentOrdersCard } from "@/components/dashboard/recent-orders-card";
import { AlertSummary } from "@/components/dashboard/alert-summary";
import { CollapsibleSection } from "@/components/dashboard/collapsible-section";

// ponytail: dynamic-import the two Recharts-bound cards so recharts stays
// out of the dashboard's initial JS bundle. Loads after hydration.
const RevenueTrendCard = dynamic(
  () => import("@/components/dashboard/revenue-trend-card").then(m => ({ default: m.RevenueTrendCard })),
  { ssr: false },
);
const ServiceCompositionCard = dynamic(
  () => import("@/components/dashboard/service-composition-card").then(m => ({ default: m.ServiceCompositionCard })),
  { ssr: false },
);
// Collapsed "customers" section (defaultOpen=false) — defer these so they stay
// out of the initial bundle/hydration; they load when the section opens.
const TopCustomersCard = dynamic(
  () => import("@/components/dashboard/top-customers-card").then(m => ({ default: m.TopCustomersCard })),
  { ssr: false },
);
const CustomerInsightsCard = dynamic(
  () => import("@/components/dashboard/customer-insights-card").then(m => ({ default: m.CustomerInsightsCard })),
  { ssr: false },
);
const LowStockCard = dynamic(
  () => import("@/components/dashboard/low-stock-card").then(m => ({ default: m.LowStockCard })),
  { ssr: false },
);
const HeatmapCard = dynamic(
  () => import("@/components/dashboard/heatmap-card").then(m => ({ default: m.HeatmapCard })),
  { ssr: false },
);
import { QuickActionsBar } from "@/components/dashboard/quick-actions-bar";
import { TurnaroundCard } from "@/components/dashboard/turnaround-card";

import type { Stats, HeatmapData } from "@/components/dashboard/dashboard-types";

function getGreeting(t: (key: string) => string): string {
  const hour = new Date().getHours();
  if (hour < 12) return t("dashboard.goodMorning");
  if (hour < 17) return t("dashboard.goodAfternoon");
  return t("dashboard.goodEvening");
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [heatmap, setHeatmap] = useState<HeatmapData | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1);
    // Local-calendar date (NOT toISOString → no UTC shift). Matches WIB business day.
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [dateTo, setDateTo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  const router = useRouter();
  const { isEmployee, isSuperAdmin, isLoading: roleLoading } = useRole();
  const { data: session } = useSession();
  const { t } = useTranslation();
  const onboardingWizard = useFeatureFlag("onboardingWizard");
  // OWNERs who haven't finished onboarding are nudged to /onboarding once.
  const pendingOnboarding =
    onboardingWizard &&
    session?.user?.role === "OWNER" &&
    !session?.user?.onboardingCompletedAt;

  useEffect(() => {
    if (roleLoading) return;
    if (isSuperAdmin) router.replace("/super-admin");
    else if (isEmployee) router.replace("/laundry/orders");
    else if (pendingOnboarding) router.replace("/onboarding");
  }, [isEmployee, isSuperAdmin, roleLoading, router, pendingOnboarding]);

  // ponytail: skip fetches until role resolves — super-admins/employees get
  // redirected by the effect above, and firing these with their null-tenantId
  // session surfaces as 5xx Prisma rejections in ErrorLog.
  // Shared fetchers — the stats/heatmap URL + data unwrap live in one place,
  // used by both the mount effects and refresh(). Previously the stats URL +
  // setStats/setStatsError wiring was copy-pasted between the effect + refresh.
  const loadStats = useCallback(
    (from: string, to: string) =>
      apiFetch<Stats>(`/api/dashboard/stats?from=${from}&to=${to}`).then((r) => r.data),
    [],
  );
  const loadHeatmap = useCallback(
    (from: string, to: string, gran: string) =>
      apiFetch<HeatmapData>(`/api/dashboard/heatmap?from=${from}&to=${to}&granularity=${gran}`).then((r) => r.data),
    [],
  );

  useEffect(() => {
    if (roleLoading || isSuperAdmin || isEmployee) return;
    let cancelled = false;
    loadStats(dateFrom, dateTo)
      .then((data) => {
        if (!cancelled) {
          setStats(data);
          setStatsError(false);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiClientError) toast.error(err.message);
        setStatsError(true);
      });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, roleLoading, isSuperAdmin, isEmployee, loadStats]);

  useEffect(() => {
    if (roleLoading || isSuperAdmin || isEmployee) return;
    let cancelled = false;
    loadHeatmap(dateFrom, dateTo, granularity)
      .then((data) => { if (!cancelled) setHeatmap(data); })
      .catch((err) => { console.warn("[dashboard] heatmap load failed", err); });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, granularity, roleLoading, isSuperAdmin, isEmployee, loadHeatmap]);

  const refresh = useCallback(() => {
    setSpinning(true);
    Promise.all([loadStats(dateFrom, dateTo), loadHeatmap(dateFrom, dateTo, granularity)])
      .then(([statsData, heatmapData]) => {
        setStats(statsData);
        setHeatmap(heatmapData);
        setStatsError(false);
      })
      .catch((err) => {
        toast.error(err instanceof ApiClientError ? err.message : t("dashboard.failedLoadStats"));
        setStatsError(true);
      })
      .finally(() => setSpinning(false));
  }, [dateFrom, dateTo, granularity, t, loadStats, loadHeatmap]);

  if (roleLoading || isEmployee || isSuperAdmin || pendingOnboarding) return null;
  // ponytail: failed initial fetch used to leave stats=null forever → infinite
  // skeleton. Surface a real error state with retry instead of a frozen loader.
  if (statsError && !stats) {
    return (
      <TooltipProvider>
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="w-full max-w-md">
            <ErrorState
              title={t("dashboard.errorTitle")}
              description={t("dashboard.failedLoadStats")}
              action={{ label: t("dashboard.tryAgain"), onClick: refresh, disabled: spinning, icon: RefreshCw }}
            />
          </div>
        </div>
      </TooltipProvider>
    );
  }
  if (!stats) return <DashboardSkeleton />;

  const userName = session?.user?.name || session?.user?.email?.split("@")[0] || t("common.friend");
  // Brand-new tenant (no customers yet) → show a welcome panel instead of a wall
  // of zero-stat cards. customerInsights.total is a customers-ever count, so this
  // flips off the moment they add their first customer / ring their first order.
  const isNewTenant = stats.customerInsights.total === 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header with date filter */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-bold text-3xl tracking-tight">{t("dashboard.title")}</h1>
            <p className="text-sm text-foreground/70 mt-0.5">
              {getGreeting(t)}, {userName}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Mobile filter toggle */}
            <Button
              variant="outline"
              size="sm"
              className="sm:hidden"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              <Calendar className="h-4 w-4 mr-1" />
              {t("common.date")}
            </Button>
            {/* Refresh button with tooltip */}
            <Tooltip>
              <TooltipTrigger render={
                <Button variant="outline" size="icon" onClick={refresh} disabled={spinning} className="h-9 w-9 shrink-0" />
              }>
                <RefreshCw className={`h-4 w-4 ${spinning ? "animate-spin" : ""}`} />
              </TooltipTrigger>
              <TooltipContent>{t("dashboard.refresh")}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Date range picker - collapsible on mobile */}
        <div className={`${filtersOpen ? 'block' : 'hidden'} sm:block`}>
          <DateRangePicker
            from={dateFrom}
            to={dateTo}
            onFromChange={setDateFrom}
            onToChange={setDateTo}
          />
        </div>

        {isNewTenant ? (
          <EmptyState
            icon={Sparkles}
            title={t("dashboard.welcomeTitle")}
            description={t("dashboard.welcomeBody")}
            actions={[
              { label: t("dashboard.welcomeFirstOrder"), onClick: () => router.push("/laundry/orders/new") },
              { label: t("dashboard.welcomeAddCustomer"), variant: "outline", onClick: () => router.push("/customers") },
              { label: t("dashboard.welcomeSetup"), variant: "outline", onClick: () => router.push("/services") },
            ]}
          />
        ) : (
          <>
        {/* Always visible: alerts + hero metrics + quick actions */}
        <AlertSummary
          unpaidOrders={stats.unpaidOrders}
          lowStock={stats.lowStock}
        />
        <StatsCards stats={stats} />
        <QuickActionsBar />

        {/* Operations: live order flow */}
        <CollapsibleSection
          id="operations"
          title={t("dashboard.sections.operations")}
          icon={Activity}
          defaultOpen={true}
        >
          <OrderPipelineCard pipeline={stats.orderPipeline} />
          <TurnaroundCard data={stats.turnaround} />
          <SLATracker />
          <KanbanBoard />
        </CollapsibleSection>

        {/* Financials: revenue + payment + outstanding */}
        <CollapsibleSection
          id="financials"
          title={t("dashboard.sections.financials")}
          icon={Wallet}
          defaultOpen={false}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <RevenueTrendCard
              data={heatmap?.revenueTrend ?? []}
              granularity={granularity}
              onGranularityChange={setGranularity}
            />
            <CashFlowCard cashFlow={stats.cashFlow} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ServiceCompositionCard services={stats.serviceBreakdown} />
            <PaymentMethodsCard breakdown={stats.paymentMethodBreakdown} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <UnpaidOrdersCard orders={stats.unpaidOrders} />
            <RecentOrdersCard
              orders={stats.recentOrders}
              onCreateOrder={() => router.push("/laundry/orders/new")}
            />
          </div>
        </CollapsibleSection>

        {/* Customers & Stock: insights + low stock + activity heatmap */}
        <CollapsibleSection
          id="customers"
          title={t("dashboard.sections.customers")}
          icon={Users}
          defaultOpen={false}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            <TopCustomersCard customers={stats.topCustomers} />
            <CustomerInsightsCard insights={stats.customerInsights} />
          </div>
          <LowStockCard lowStock={stats.lowStock} />
          {heatmap && <HeatmapCard heatmap={heatmap} />}
        </CollapsibleSection>
          </>
        )}
      </div>
    </TooltipProvider>
  );
}
