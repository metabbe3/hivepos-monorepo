"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Search } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { formatDate } from "@/lib/format";
import { ApproveButton } from "./approve-button";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/super-admin/labels";
import {
  PageHeader,
  Toolbar,
  DataTable,
  type Column,
  StatusPill,
  type PillTone,
  CountChip,
} from "@/components/super-admin";

const SUB_TONE: Record<string, PillTone> = {
  TRIAL: "warning",
  ACTIVE: "success",
  PAST_DUE: "danger",
  CANCELED: "muted",
  EXPIRED: "muted",
};

type TenantRow = {
  id: string;
  name: string;
  slug: string;
  ownerEmail: string;
  isActive: boolean;
  approvedAt: string | null;
  createdAt: string;
  subscription: { status: string } | null;
  _count: { branches: number };
};

export default function TenantsIndexPage() {
  const [rows, setRows] = useState<TenantRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch<TenantRow[]>("/api/super-admin/tenants")
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([])); // endpoint pending in hivepos-api (PORT-DEBT §2)
  }, []);

  const pendingCount = useMemo(
    () => rows.filter((t) => t.approvedAt === null).length,
    [rows],
  );

  // ponytail: pending-first sort done in JS — saves a raw SQL orderBy.
  const tenants = useMemo(() => {
    const query = q.trim().toLowerCase();
    const filtered = query
      ? rows.filter((t) =>
          [t.name, t.slug, t.ownerEmail].some((f) => f?.toLowerCase().includes(query)),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const aPending = a.approvedAt === null ? 0 : 1;
      const bPending = b.approvedAt === null ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [rows, q]);

  const columns: Column<TenantRow>[] = [
    {
      key: "name",
      header: "Tenant",
      render: (t) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-semibold text-primary">
            {t.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div>{t.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{t.slug}</div>
          </div>
        </div>
      ),
    },
    { key: "owner", header: "Owner", render: (t) => <span className="text-muted-foreground">{t.ownerEmail}</span> },
    {
      key: "outlets",
      header: "Outlets",
      align: "right",
      render: (t) => <span className="sa-tnum">{t._count?.branches ?? 0}</span>,
    },
    {
      key: "sub",
      header: "Sub",
      render: (t) =>
        t.subscription?.status ? (
          <StatusPill
            tone={SUB_TONE[t.subscription.status] ?? "muted"}
            label={SUBSCRIPTION_STATUS_LABELS[t.subscription.status] ?? t.subscription.status}
          />
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) =>
        t.approvedAt === null ? (
          <StatusPill tone="warning" dot label="Pending" />
        ) : t.isActive ? (
          <StatusPill tone="success" dot label="Active" />
        ) : (
          <StatusPill tone="danger" dot label="Suspended" />
        ),
    },
    {
      key: "created",
      header: "Created",
      align: "right",
      render: (t) => <span className="text-muted-foreground">{formatDate(t.createdAt)}</span>,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Customers"
        title="Tenants"
        subtitle="All businesses on the platform. Pending approvals surface first."
        icon={Building2}
        actions={pendingCount > 0 ? <CountChip count={pendingCount} label="pending" tone="warning" /> : undefined}
      />

      <Toolbar
        left={
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, slug, or owner…"
              aria-label="Search tenants"
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent pl-9 pr-2.5 py-1 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus:outline-none"
            />
          </div>
        }
      />

      <DataTable
        columns={columns}
        rows={tenants}
        getRowKey={(t) => t.id}
        getRowHref={(t) => `/super-admin/tenants/${t.id}`}
        rowActions={(t) => (t.approvedAt === null ? <ApproveButton tenantId={t.id} /> : null)}
        emptyState={{
          icon: Building2,
          title: q ? "No matching tenants" : "No tenants yet",
          hint: q ? "Try a different search." : "New signups will appear here.",
        }}
      />
    </div>
  );
}
