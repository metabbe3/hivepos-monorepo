import Link from "next/link";
import { Users as UsersIcon } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { getPlatformUsers } from "@/lib/user-admin";
import { formatDate } from "@/lib/format";
import { USER_ROLE_LABELS } from "@/lib/super-admin/labels";
import { UserRowActions } from "./user-row-actions";
import {
  PageHeader,
  Toolbar,
  SearchInput,
  DataTable,
  type Column,
  StatusPill,
  Pagination,
  type PillTone,
} from "@/components/super-admin";
import { CsvExportButton } from "@/components/shared/csv-export-button";

const PAGE_SIZE = 50;

const ROLE_TONE: Record<string, PillTone> = {
  OWNER: "primary",
  SUPER_ADMIN: "primary",
  SUPPORT: "primary",
  MANAGER: "default",
  CASHIER: "muted",
  EMPLOYEE: "muted",
};

export default async function SuperAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const viewerSession = await requireSuperAdminPanelSession();
  const viewerIsSuperAdmin = (viewerSession.user as any).role === "SUPER_ADMIN";

  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const page = Math.max(1, Number(sp.page ?? "1"));

  const result = await getPlatformUsers({
    ...(q && { q }),
    page,
    pageSize: PAGE_SIZE,
  });

  function buildPageHref(p: number): string {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/super-admin/users?${qs}` : "/super-admin/users";
  }

  type UserRow = (typeof result.rows)[number];

  const columns: Column<UserRow>[] = [
    {
      key: "name",
      header: "User",
      render: (u) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-semibold text-primary">
            {(u.name ?? u.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <div>{u.name}</div>
            <div className="text-xs font-normal text-muted-foreground">{u.email}</div>
          </div>
        </div>
      ),
    },
    {
      key: "tenant",
      header: "Tenant",
      render: (u) =>
        u.tenantId ? (
          <Link href={`/super-admin/tenants/${u.tenantId}`} className="hover:underline">
            {u.tenantName}
          </Link>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        ),
    },
    {
      key: "role",
      header: "Role",
      render: (u) => (
        <StatusPill tone={ROLE_TONE[u.role] ?? "muted"} label={USER_ROLE_LABELS[u.role] ?? u.role} />
      ),
    },
    { key: "branch", header: "Branch", render: (u) => <span className="text-muted-foreground">{u.branchName ?? "—"}</span> },
    {
      key: "status",
      header: "Status",
      render: (u) => <StatusPill tone={u.isActive ? "success" : "danger"} dot label={u.isActive ? "Active" : "Suspended"} />,
    },
    {
      key: "created",
      header: "Joined",
      align: "right",
      render: (u) => <span className="text-muted-foreground">{formatDate(u.createdAt)}</span>,
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Customers"
        title="Users"
        subtitle="Every user across every tenant on the platform."
        icon={UsersIcon}
      />

      <Toolbar
        left={
          <form method="GET" action="/super-admin/users" className="flex items-center gap-2">
            <SearchInput value={q ?? ""} placeholder="Search by email or name…" className="w-72" />
          </form>
        }
        right={
          <CsvExportButton url={`/api/super-admin/users/export${q ? `?q=${encodeURIComponent(q)}` : ""}`} />
        }
      />

      <DataTable
        columns={columns}
        rows={result.rows}
        getRowKey={(u) => u.id}
        rowActions={(u) => (
          <UserRowActions
            userId={u.id}
            userEmail={u.email}
            isActive={u.isActive}
            canImpersonate={
              viewerIsSuperAdmin &&
              u.isActive &&
              u.role !== "OWNER" // ponytail: defense in depth — never let super-admin shadow an owner
            }
          />
        )}
        emptyState={{
          icon: UsersIcon,
          title: q ? "No matching users" : "No users yet",
          hint: q ? "Try a different search." : "Users will appear here once they sign up.",
        }}
      />

      <Pagination page={result.page} hasNext={result.hasNext} buildHref={buildPageHref} />
    </div>
  );
}
