"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/modules/shared";
import { formatCurrency, formatDate } from "@/lib/format";
import { TenantDetailClient } from "./tenant-detail-client";
import { SubscriptionManager } from "./subscription-manager";
import { WhatsAppToggle } from "./whatsapp-toggle";
import { SAAS_PAYMENT_STATUS_LABELS, SUBSCRIPTION_STATUS_LABELS } from "@/lib/super-admin/labels";
import {
  Building2,
  CreditCard,
  MessageCircle,
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

// Payload shape from /api/super-admin/tenants/{id} (Go endpoint pending — PORT-DEBT §2).
// Typed loosely; fields render as they land.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Detail = any;

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

export default function TenantDetailPage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const [d, setD] = useState<Detail>(null);

  // Data is client-state (useState), so router.refresh() (server-component only)
  // does NOT update it after a mutation. Children call reload() via onMutated.
  const reload = useCallback(() => {
    if (!id) return;
    apiFetch<Detail>(`/api/super-admin/tenants/${id}`)
      .then(({ data }) => setD(data ?? null))
      .catch(() => setD(null)); // endpoint pending in hivepos-api (PORT-DEBT §2)
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!d) {
    return (
      <div className="animate-fade-in-up p-12 text-center text-sm text-muted-foreground">
        Loading tenant…
      </div>
    );
  }

  const tenant = d.tenant ?? d;
  const perf = d;
  const staffCount: number = d.staffCount ?? 0;
  const subscription = d.subscription ?? null;
  const activePlans: { id: string; name: string; priceMonthly: number }[] = d.plans ?? [];
  const planName: string = perf.planName ?? subscription?.plan?.name ?? "—";
  const trialEndsAt = tenant.trialEndsAt ?? null;

  return (
    <div className="animate-fade-in-up">
      <DetailShell
        backHref="/super-admin/tenants"
        backLabel="Tenants"
        headerExtra={<TenantDetailClient tenantId={tenant.id} isActive={tenant.isActive} onMutated={reload} />}
      >
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl font-bold text-primary">
            {tenant.name?.charAt(0)}
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

        <StatGrid cols={4} className="mb-4">
          <MetricTile
            icon={Building2}
            label="Plan"
            value={planName}
            index={0}
            sub={perf.subscriptionStatus ? (SUBSCRIPTION_STATUS_LABELS[perf.subscriptionStatus] ?? perf.subscriptionStatus) : undefined}
          />
          <MetricTile
            icon={Store}
            label="Outlets"
            value={
              <>
                <span className="sa-tnum">{perf.activeOutlets ?? 0}</span>
                <span className="ml-1 text-sm text-muted-foreground">/{perf.totalOutlets ?? 0}</span>
              </>
            }
            sub="active"
            index={1}
          />
          <MetricTile icon={Users} label="Staff" value={<span className="sa-tnum">{staffCount}</span>} index={2} />
          <MetricTile
            icon={Power}
            label="Trial Ends"
            value={trialEndsAt ? formatDate(trialEndsAt) : "—"}
            sub={perf.trialDaysRemaining != null ? `${perf.trialDaysRemaining}d left` : undefined}
            tone={perf.trialDaysRemaining != null && perf.trialDaysRemaining <= 3 ? "danger" : undefined}
            index={3}
          />
        </StatGrid>

        <StatGrid cols={6} className="mb-6">
          <MetricTile icon={ShoppingBag} label="Orders 30d" value={<span className="sa-tnum">{perf.orders30d ?? 0}</span>} index={0} />
          <MetricTile icon={ShoppingBag} label="All" value={<span className="sa-tnum text-muted-foreground">{perf.ordersAll ?? 0}</span>} index={1} />
          <MetricTile icon={TrendingUp} label="Revenue 30d" value={formatCurrency(perf.revenue30d ?? 0)} tone="primary" index={2} />
          <MetricTile icon={DollarSign} label="Revenue All" value={formatCurrency(perf.revenueAll ?? 0)} index={3} />
          <MetricTile icon={CreditCard} label="SaaS Paid" value={formatCurrency(perf.saasRevenuePaid ?? 0)} tone="success" index={4} />
          <MetricTile
            icon={Clock}
            label="Last Order"
            value={perf.daysSinceLastOrder == null ? "never" : `${perf.daysSinceLastOrder}d`}
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
              <ProfileRow label="Active modules" value={(tenant.activeModules ?? []).join(", ") || "—"} />
              <ProfileRow label="Created" value={formatDate(tenant.createdAt)} />
            </dl>
          </DetailSection>

          <DetailSection title="Recent Payments" icon={CreditCard}>
            {(perf.recentPayments ?? []).length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border/40">
                {(perf.recentPayments ?? []).map((p: any) => (
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
              onMutated={reload}
              info={{
                status: subscription?.status ?? null,
                planId: subscription?.planId ?? null,
                planName: subscription?.plan?.name ?? null,
                currentPeriodEnd: subscription?.currentPeriodEnd ?? null,
                paidOutletCount: subscription?.paidOutletCount ?? 0,
              }}
              plans={activePlans}
            />
          </DetailSection>
        </div>

        <div className="mt-4">
          <DetailSection title="WhatsApp Access" icon={MessageCircle}>
            <WhatsAppToggle
              tenantId={tenant.id}
              initialEnabled={!!(d.settings as Record<string, unknown>)?.whatsappEnabled}
              onChanged={reload}
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
