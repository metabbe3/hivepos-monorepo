"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/modules/shared";
import { formatCurrency } from "@/lib/format";
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

interface Stats {
  mrr: number;
  activePaidOutlets: number;
  paidTenantCount: number;
  failedCount30d: number;
  lifetimeGross: number;
  totalTenants: number;
  activeTenants: number;
  trialTenants: number;
  pendingApprovals: number;
  suspendedTenants: number;
  totalUsers: number;
  totalOrders: number;
  openTickets: number;
  urgentTickets: number;
  unresolvedErrors: number;
  pastDueSubs: number;
  canceledSubs: number;
}

const EMPTY: Stats = {
  mrr: 0, activePaidOutlets: 0, paidTenantCount: 0, failedCount30d: 0, lifetimeGross: 0,
  totalTenants: 0, activeTenants: 0, trialTenants: 0, pendingApprovals: 0, suspendedTenants: 0,
  totalUsers: 0, totalOrders: 0, openTickets: 0, urgentTickets: 0, unresolvedErrors: 0,
  pastDueSubs: 0, canceledSubs: 0,
};

function toneFor(count: number, severity: "warning" | "danger"): Tone {
  if (count === 0) return "default";
  return severity;
}

export default function SuperAdminOverviewPage() {
  const [s, setS] = useState<Stats>(EMPTY);

  useEffect(() => {
    apiFetch<Record<string, unknown>>("/api/super-admin/stats")
      .then(({ data }) => {
        const d: Record<string, unknown> = data ?? {};
        // Go's /api/super-admin/stats uses pendingTenants; map to the page's pendingApprovals.
        setS({
          ...EMPTY,
          ...(data as unknown as Stats),
          pendingApprovals: Number(d.pendingApprovals ?? d.pendingTenants ?? 0),
        });
      })
      .catch(() => setS(EMPTY)); // endpoint pending in hivepos-api (PORT-DEBT §2)
  }, []);

  const healthItems = [
    { count: s.pendingApprovals, label: "Pending Approvals", tone: toneFor(s.pendingApprovals, "warning") },
    { count: s.openTickets, label: "Open Tickets", tone: toneFor(s.openTickets, "warning") },
    { count: s.urgentTickets, label: "Urgent Tickets", tone: toneFor(s.urgentTickets, "danger") },
    { count: s.unresolvedErrors, label: "Unresolved Errors", tone: toneFor(s.unresolvedErrors, "danger") },
    { count: s.failedCount30d, label: "Failed Payments (30d)", tone: toneFor(s.failedCount30d, "danger") },
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
          value={formatCurrency(s.mrr)}
          sub={`${s.activePaidOutlets} outlets × Rp 49K`}
          tone="primary"
          span={2}
          index={0}
        />
        <MetricTile icon={CreditCard} label="Paid Tenants" value={s.paidTenantCount} tone="success" index={1} />
        <MetricTile icon={Store} label="Active Paid Outlets" value={s.activePaidOutlets} index={2} />
        <MetricTile icon={Building2} label="Total Tenants" value={s.totalTenants} index={3} />
        <MetricTile icon={TrendingUp} label="Active Tenants" value={s.activeTenants} index={4} />
        <MetricTile icon={AlertCircle} label="Trial Tenants" value={s.trialTenants} index={5} />
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
          value={s.pastDueSubs}
          href="/super-admin/tenants"
          tone={toneFor(s.pastDueSubs, "danger")}
          index={0}
        />
        <MetricTile
          icon={UserMinus}
          label="Churned (Canceled)"
          value={s.canceledSubs}
          href="/super-admin/tenants"
          tone={toneFor(s.canceledSubs, "warning")}
          index={1}
        />
        <MetricTile
          icon={Ban}
          label="Suspended Tenants"
          value={s.suspendedTenants}
          href="/super-admin/tenants"
          tone={toneFor(s.suspendedTenants, "warning")}
          index={2}
        />
      </StatGrid>

      {/* Footer strip — demoted context */}
      <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl bg-card px-5 py-3 text-xs text-muted-foreground ring-1 ring-foreground/10 shadow-sm">
        <span className="flex items-center gap-1.5">
          <DollarSign className="h-3.5 w-3.5" />
          Lifetime Gross:{" "}
          <strong className="sa-tnum text-foreground">{formatCurrency(s.lifetimeGross)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          Total Users: <strong className="sa-tnum text-foreground">{s.totalUsers}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <ShoppingBag className="h-3.5 w-3.5" />
          Total Orders: <strong className="sa-tnum text-foreground">{s.totalOrders}</strong>
        </span>
      </div>
    </div>
  );
}
