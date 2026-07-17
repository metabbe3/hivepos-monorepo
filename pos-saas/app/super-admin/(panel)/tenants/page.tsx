import { Building2, Search } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/format";
import { ApproveButton } from "./approve-button";
import { SUBSCRIPTION_STATUS_LABELS } from "@/lib/super-admin/labels";
import {
  PageHeader,
  Toolbar,
  SearchInput,
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
  approvedAt: Date | null;
  createdAt: Date;
  subscription: { status: string } | null;
  _count: { branches: number };
};

export default async function TenantsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdminPanelSession();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" as const } },
          { slug: { contains: q, mode: "insensitive" as const } },
          { ownerEmail: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, pendingCount] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerEmail: true,
        isActive: true,
        approvedAt: true,
        createdAt: true,
        subscription: { select: { status: true } },
        _count: { select: { branches: true } },
      },
    }),
    prisma.tenant.count({ where: { approvedAt: null } }),
  ]);

  // ponytail: pending-first sort done in JS — saves a raw SQL orderBy and
  // keeps the query simple. Pending = approvedAt === null.
  const tenants = [...rows].sort((a, b) => {
    const aPending = a.approvedAt === null ? 0 : 1;
    const bPending = b.approvedAt === null ? 0 : 1;
    if (aPending !== bPending) return aPending - bPending;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

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
      render: (t) => <span className="sa-tnum">{t._count.branches}</span>,
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
          <form method="GET" action="/super-admin/tenants" className="flex items-center gap-2">
            <SearchInput value={q} placeholder="Search name, slug, or owner…" className="w-72" />
          </form>
        }
      />

      <DataTable
        columns={columns}
        rows={tenants}
        getRowKey={(t) => t.id}
        getRowHref={(t) => `/super-admin/tenants/${t.id}`}
        rowActions={(t) =>
          t.approvedAt === null ? <ApproveButton tenantId={t.id} /> : null
        }
        emptyState={{
          icon: Building2,
          title: q ? "No matching tenants" : "No tenants yet",
          hint: q ? "Try a different search." : "New signups will appear here.",
        }}
      />
    </div>
  );
}
