import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getPlatformBillingOverview } from "@/lib/billing-analytics";
import {
  Building2,
  Users,
  ShoppingBag,
  DollarSign,
  TrendingUp,
  AlertCircle,
  CreditCard,
  Store,
  Clock,
  MessageSquare,
  AlertTriangle,
  Bug,
  XCircle,
  UserMinus,
  Ban,
  LayoutDashboard,
} from "lucide-react";
import {
  PageHeader,
  StatGrid,
  SectionEyebrow,
  MetricTile,
  type TileTone,
  StatusPill,
} from "@/components/super-admin";

type Tone = TileTone;

function toneFor(count: number, severity: "warning" | "danger"): Tone {
  if (count === 0) return "default";
  return severity;
}

export default async function SuperAdminOverviewPage() {
  await requireSuperAdminPanelSession();

  const [
    billing,
    totalTenants,
    activeTenants,
    trialTenants,
    pendingApprovals,
    suspendedTenants,
    totalUsers,
    totalOrders,
    openTickets,
    urgentTickets,
    unresolvedErrors,
    pastDueSubs,
    canceledSubs,
  ] = await Promise.all([
    getPlatformBillingOverview(),
    prisma.tenant.count(),
    prisma.tenant.count({ where: { isActive: true } }),
    prisma.subscription.count({ where: { status: "TRIAL" } }),
    prisma.tenant.count({ where: { approvedAt: null } }),
    prisma.tenant.count({ where: { isActive: false, approvedAt: { not: null } } }),
    prisma.user.count(),
    prisma.order.count(),
    prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    prisma.supportTicket.count({
      where: { priority: "URGENT", status: { in: ["OPEN", "IN_PROGRESS"] } },
    }),
    prisma.errorLog.count({ where: { resolved: false } }),
    prisma.subscription.count({ where: { status: "PAST_DUE" } }),
    prisma.subscription.count({ where: { status: "CANCELED" } }),
  ]);

  const healthItems = [
    { count: pendingApprovals, label: "Pending Approvals", tone: toneFor(pendingApprovals, "warning") },
    { count: openTickets, label: "Open Tickets", tone: toneFor(openTickets, "warning") },
    { count: urgentTickets, label: "Urgent Tickets", tone: toneFor(urgentTickets, "danger") },
    { count: unresolvedErrors, label: "Unresolved Errors", tone: toneFor(unresolvedErrors, "danger") },
    { count: billing.failedCount30d, label: "Failed Payments (30d)", tone: toneFor(billing.failedCount30d, "danger") },
  ] as const;

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Overview"
        title="Platform Overview"
        subtitle="Real-time pulse of hivePOS — what needs attention right now."
        icon={LayoutDashboard}
        actions={<StatusPill tone="success" dot pulse label="Live" />}
      />

      {/* Section 1: Business Health — bento */}
      <SectionEyebrow>Business Health</SectionEyebrow>
      <StatGrid cols={6}>
        <MetricTile
          icon={DollarSign}
          label="MRR"
          value={formatCurrency(billing.mrr)}
          sub={`${billing.activePaidOutlets} outlets × Rp 49K`}
          tone="primary"
          span={2}
          index={0}
        />
        <MetricTile
          icon={CreditCard}
          label="Paid Tenants"
          value={billing.paidTenantCount}
          tone="success"
          index={1}
        />
        <MetricTile
          icon={Store}
          label="Active Paid Outlets"
          value={billing.activePaidOutlets}
          index={2}
        />
        <MetricTile icon={Building2} label="Total Tenants" value={totalTenants} index={3} />
        <MetricTile icon={TrendingUp} label="Active Tenants" value={activeTenants} index={4} />
        <MetricTile icon={AlertCircle} label="Trial Tenants" value={trialTenants} index={5} />
      </StatGrid>

      {/* Section 2: Action Needed */}
      <SectionEyebrow>Action Needed</SectionEyebrow>
      <StatGrid cols={6}>
        {healthItems.map((m, i) => (
          <MetricTile
            key={m.label}
            icon={[Clock, MessageSquare, AlertTriangle, Bug, XCircle][i]}
            label={m.label}
            value={m.count}
            href={
              ["/super-admin/tenants", "/super-admin/tickets", "/super-admin/tickets?priority=URGENT", "/super-admin/error-logs", "/super-admin/billing"][i]
            }
            tone={m.tone}
            index={i}
          />
        ))}
      </StatGrid>

      {/* Section 3: Risk Signals */}
      <SectionEyebrow>Risk Signals</SectionEyebrow>
      <StatGrid cols={3}>
        <MetricTile
          icon={AlertCircle}
          label="Past Due Subs"
          value={pastDueSubs}
          href="/super-admin/tenants"
          tone={toneFor(pastDueSubs, "danger")}
          index={0}
        />
        <MetricTile
          icon={UserMinus}
          label="Churned (Canceled)"
          value={canceledSubs}
          href="/super-admin/tenants"
          tone={toneFor(canceledSubs, "warning")}
          index={1}
        />
        <MetricTile
          icon={Ban}
          label="Suspended Tenants"
          value={suspendedTenants}
          href="/super-admin/tenants"
          tone={toneFor(suspendedTenants, "warning")}
          index={2}
        />
      </StatGrid>

      {/* Footer strip — demoted context */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-card px-5 py-3 text-xs text-muted-foreground ring-1 ring-foreground/10 shadow-sm">
        <span className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          Lifetime Gross:{" "}
          <strong className="sa-tnum text-foreground">{formatCurrency(billing.lifetimeGross)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Total Users: <strong className="sa-tnum text-foreground">{totalUsers}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5" />
          Total Orders: <strong className="sa-tnum text-foreground">{totalOrders}</strong>
        </span>
      </div>
    </div>
  );
}
