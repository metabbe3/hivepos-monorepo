import { notFound } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/format";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getTenantPerformanceById } from "@/lib/tenant-performance";
import { prisma } from "@/lib/prisma";
import { TenantDetailClient } from "./tenant-detail-client";
import { SubscriptionManager } from "./subscription-manager";
import { SAAS_PAYMENT_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/super-admin/labels";
import {
  Building2,
  CreditCard,
  Users,
  Store,
  Power,
  ShoppingBag,
  TrendingUp,
  Clock,
  DollarSign,
} from "lucide-react";
import {
  DetailShell,
  DetailSection,
  MetricTile,
  StatGrid,
  StatusPill,
  type PillTone,
} from "@/components/super-admin";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSuperAdminPanelSession();
  const { id } = await params;

  const perf = await getTenantPerformanceById(id);
  if (!perf) notFound();

  // ponytail: staff count not in getTenantPerformanceById (avoids N+1 for no other reason)
  const staffCount = await prisma.user.count({ where: { tenantId: id } });

  const [activePlans, subscription] = await Promise.all([
    prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { priceMonthly: "asc" },
      select: { id: true, name: true, priceMonthly: true },
    }),
    prisma.subscription.findUnique({
      where: { tenantId: id },
      select: {
        id: true,
        status: true,
        planId: true,
        plan: { select: { name: true } },
        currentPeriodEnd: true,
        paidOutletCount: true,
      },
    }),
  ]);

  const { tenant } = perf;
  const trialEndsAt = tenant.trialEndsAt;
  const planName = perf.planName;

  const SUB_TONE: Record<string, PillTone> = {
    TRIAL: "warning",
    ACTIVE: "success",
    PAST_DUE: "danger",
    CANCELED: "muted",
    EXPIRED: "muted",
  };

  const PAYMENT_TONE: Record<string, PillTone> = {
    PENDING: "warning",
    PAID: "success",
    FAILED: "danger",
    REFUNDED: "muted",
  };

  return (
    <div className="animate-fade-in-up">
      <DetailShell
        backHref="/super-admin/tenants"
        backLabel="Tenants"
        headerExtra={
          <TenantDetailClient tenantId={tenant.id} isActive={tenant.isActive} />
        }
      >
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {tenant.name.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="font-mono text-xs">{tenant.slug}.hivepos.id</span>
              {tenant.isActive ? (
                <StatusPill tone="success" dot label="Active" />
              ) : (
                <StatusPill tone="danger" dot label="Suspended" />
              )}
              {perf.subscriptionStatus && (
                <StatusPill
                  tone={SUB_TONE[perf.subscriptionStatus] ?? "muted"}
                  label={SUBSCRIPTION_STATUS_LABELS[perf.subscriptionStatus] ?? perf.subscriptionStatus}
                />
              )}
            </div>
          </div>
        </div>

        {/* Top row: identity bento */}
        <StatGrid cols={4} className="mb-4">
          <MetricTile icon={Building2} label="Plan" value={planName} index={0}
            sub={perf.subscriptionStatus ? (SUBSCRIPTION_STATUS_LABELS[perf.subscriptionStatus] ?? perf.subscriptionStatus) : undefined}
          />
          <MetricTile icon={Store} label="Outlets" value={
            <>
              <span className="sa-tnum">{perf.activeOutlets}</span>
              <span className="ml-1 text-sm text-muted-foreground">/{perf.totalOutlets}</span>
            </>
          } sub="active" index={1} />
          <MetricTile icon={Users} label="Staff" value={<span className="sa-tnum">{staffCount}</span>} index={2} />
          <MetricTile
            icon={Power}
            label="Trial Ends"
            value={trialEndsAt ? formatDate(trialEndsAt) : "—"}
            sub={perf.trialDaysRemaining !== null ? `${perf.trialDaysRemaining}d left` : undefined}
            tone={perf.trialDaysRemaining !== null && perf.trialDaysRemaining <= 3 ? "danger" : undefined}
            index={3}
          />
        </StatGrid>

        {/* Performance row */}
        <StatGrid cols={6} className="mb-6">
          <MetricTile icon={ShoppingBag} label="Orders 30d" value={<span className="sa-tnum">{perf.orders30d}</span>} index={0} />
          <MetricTile icon={ShoppingBag} label="All" value={<span className="sa-tnum text-muted-foreground">{perf.ordersAll}</span>} index={1} />
          <MetricTile icon={TrendingUp} label="Revenue 30d" value={formatCurrency(perf.revenue30d)} tone="primary" index={2} />
          <MetricTile icon={DollarSign} label="Revenue All" value={formatCurrency(perf.revenueAll)} index={3} />
          <MetricTile icon={CreditCard} label="SaaS Paid" value={formatCurrency(perf.saasRevenuePaid)} tone="success" index={4} />
          <MetricTile
            icon={Clock}
            label="Last Order"
            value={perf.daysSinceLastOrder === null ? "never" : `${perf.daysSinceLastOrder}d`}
            index={5}
          />
        </StatGrid>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DetailSection title="Profile" icon={Building2}>
            <dl className="space-y-3 text-sm">
              <ProfileRow label="Owner name" value={tenant.ownerName ?? "—"} />
              <ProfileRow label="Owner email" value={tenant.ownerEmail} />
              <ProfileRow label="Owner phone" value={tenant.ownerPhone ?? "—"} />
              <ProfileRow label="Custom domain" value={tenant.customDomain ?? "—"} />
              <ProfileRow label="Active modules" value={tenant.activeModules.join(", ") || "—"} />
              <ProfileRow label="Created" value={formatDate(tenant.createdAt)} />
            </dl>
          </DetailSection>

          <DetailSection title="Recent Payments" icon={CreditCard}>
            {perf.recentPayments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {perf.recentPayments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-medium sa-tnum">{formatCurrency(p.amount)}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {p.outletCount} outlet × {p.monthsPurchased}mo
                        {p.coverageEnd ? ` · until ${formatDate(p.coverageEnd)}` : ""}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StatusPill
                        tone={PAYMENT_TONE[p.status] ?? "muted"}
                        label={SAAS_PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      />
                      <span className="text-xs text-muted-foreground">{formatDate(p.paidAt ?? p.createdAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </DetailSection>
        </div>

        <div className="mt-4">
          <DetailSection title="Subscription" icon={CreditCard}>
            <SubscriptionManager
              tenantId={tenant.id}
              info={{
                status: subscription?.status ?? null,
                planId: subscription?.planId ?? null,
                planName: subscription?.plan.name ?? null,
                currentPeriodEnd: subscription?.currentPeriodEnd?.toISOString() ?? null,
                paidOutletCount: subscription?.paidOutletCount ?? 0,
              }}
              plans={activePlans.map((p) => ({ id: p.id, name: p.name, priceMonthly: Number(p.priceMonthly) }))}
            />
          </DetailSection>
        </div>
      </DetailShell>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
