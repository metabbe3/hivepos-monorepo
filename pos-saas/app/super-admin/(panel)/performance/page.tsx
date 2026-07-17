import Link from "next/link";
import { TrendingUp, ShoppingBag, Building2 } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import {
  getTenantPerformance,
  type TenantSortKey,
} from "@/lib/tenant-performance";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/super-admin/labels";
import {
  PageHeader,
  StatGrid,
  MetricTile,
  FilterBar,
  type FilterGroup,
  DataTable,
  type Column,
  StatusPill,
  type PillTone,
} from "@/components/super-admin";

const SORT_OPTIONS: { key: TenantSortKey; label: string }[] = [
  { key: "rev30d", label: "Revenue (30d)" },
  { key: "revAll", label: "Revenue (all)" },
  { key: "orders30d", label: "Orders (30d)" },
  { key: "ordersAll", label: "Orders (all)" },
  { key: "name", label: "Name" },
];

const VALID_SORTS = SORT_OPTIONS.map((s) => s.key);

const SUB_TONE: Record<string, PillTone> = {
  TRIAL: "warning",
  ACTIVE: "success",
  PAST_DUE: "danger",
  CANCELED: "muted",
  EXPIRED: "muted",
};

type Row = Awaited<ReturnType<typeof getTenantPerformance>>[number];

export default async function PerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminPanelSession();
  const sp = await searchParams;
  const sortParam = typeof sp.sort === "string" ? sp.sort : undefined;
  const sort: TenantSortKey =
    sortParam && (VALID_SORTS as readonly string[]).includes(sortParam)
      ? (sortParam as TenantSortKey)
      : "rev30d";

  const rows = await getTenantPerformance({ sort });

  const totalRev30d = rows.reduce((s, r) => s + Number(r.revenue30d), 0);
  const totalOrders30d = rows.reduce((s, r) => s + r.orders30d, 0);
  const avgRev = rows.length ? totalRev30d / rows.length : 0;

  const filterGroup: FilterGroup = {
    field: "sort",
    active: sort,
    options: SORT_OPTIONS.map((o) => ({ key: o.key, label: o.label })),
  };

  function buildHref(field: string, key: string): string {
    const params = new URLSearchParams();
    if (field === "sort" && key !== "rev30d") params.set("sort", key);
    const qs = params.toString();
    return qs ? `/super-admin/performance?${qs}` : "/super-admin/performance";
  }

  const columns: Column<Row>[] = [
    {
      key: "name",
      header: "Tenant",
      render: (r) => (
        <div>
          <div>{r.name}</div>
          <div className="text-xs font-normal text-muted-foreground">{r.slug}</div>
          {!r.isActive && <span className="ml-2 text-[10px] uppercase text-destructive">suspended</span>}
        </div>
      ),
    },
    {
      key: "outlets",
      header: "Outlets",
      align: "right",
      render: (r) => (
        <span className="sa-tnum">
          <span className="font-semibold">{r.activeOutlets}</span>
          <span className="text-muted-foreground">/{r.totalOutlets}</span>
        </span>
      ),
    },
    {
      key: "orders30d",
      header: "Orders (30d)",
      align: "right",
      render: (r) => <span className="sa-tnum">{r.orders30d}</span>,
    },
    {
      key: "ordersAll",
      header: "All",
      align: "right",
      render: (r) => <span className="sa-tnum text-muted-foreground">{r.ordersAll}</span>,
    },
    {
      key: "revenue30d",
      header: "Revenue (30d)",
      align: "right",
      render: (r) => (
        <span className="sa-tnum font-semibold">{formatCompactCurrency(r.revenue30d)}</span>
      ),
    },
    {
      key: "revenueAll",
      header: "Revenue (all)",
      align: "right",
      render: (r) => (
        <span className="sa-tnum text-muted-foreground">{formatCompactCurrency(r.revenueAll)}</span>
      ),
    },
    {
      key: "saasPaid",
      header: "SaaS Paid",
      align: "right",
      render: (r) => (
        <span className="sa-tnum text-muted-foreground">{formatCompactCurrency(r.saasRevenuePaid)}</span>
      ),
    },
    {
      key: "sub",
      header: "Sub",
      render: (r) =>
        r.subscriptionStatus ? (
          <StatusPill tone={SUB_TONE[r.subscriptionStatus] ?? "muted"} label={SUBSCRIPTION_STATUS_LABELS[r.subscriptionStatus] ?? r.subscriptionStatus} />
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "trial",
      header: "Trial",
      align: "right",
      render: (r) =>
        r.trialDaysRemaining !== null ? (
          <span className={`sa-tnum ${r.trialDaysRemaining <= 3 ? "text-destructive font-semibold" : ""}`}>
            {r.trialDaysRemaining}d
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "last",
      header: "Last Order",
      align: "right",
      render: (r) => (
        <span className="sa-tnum text-muted-foreground">
          {r.daysSinceLastOrder === null ? "never" : `${r.daysSinceLastOrder}d`}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Monitor"
        title="Tenant Performance"
        subtitle="Cross-tenant revenue, order volume, and trial health."
        icon={TrendingUp}
      />

      <StatGrid cols={3} className="mb-6">
        <MetricTile
          icon={TrendingUp}
          label="Total Revenue (30d)"
          value={formatCurrency(totalRev30d)}
          tone="primary"
          index={0}
        />
        <MetricTile
          icon={ShoppingBag}
          label="Total Orders (30d)"
          value={totalOrders30d.toLocaleString()}
          tone="success"
          index={1}
        />
        <MetricTile
          icon={Building2}
          label="Avg Revenue / Tenant"
          value={formatCurrency(avgRev)}
          sub={`${rows.length} tenants`}
          index={2}
        />
      </StatGrid>

      <div className="mb-4">
        <FilterBar groups={[filterGroup]} buildHref={buildHref} />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowKey={(r) => r.id}
        getRowHref={(r) => `/super-admin/tenants/${r.id}`}
        emptyState={{ icon: Building2, title: "No tenants yet", hint: "Once tenants sign up, they'll appear here." }}
      />
    </div>
  );
}
