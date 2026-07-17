"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Users as UsersIcon, Search } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { useSession } from "@/lib/auth-client";
import { formatDate } from "@/lib/format";
import { USER_ROLE_LABELS } from "@/lib/super-admin/labels";
import { UserRowActions } from "./user-row-actions";
import {
  PageHeader,
  Toolbar,
  DataTable,
  type Column,
  StatusPill,
  type PillTone,
} from "@/components/super-admin";
import { CsvExportButton } from "@/components/shared/csv-export-button";

const ROLE_TONE: Record<string, PillTone> = {
  OWNER: "primary",
  SUPER_ADMIN: "primary",
  SUPPORT: "primary",
  MANAGER: "default",
  CASHIER: "muted",
  EMPLOYEE: "muted",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  tenantId?: string;
  tenantName?: string;
  branchName?: string;
  isActive: boolean;
  createdAt: string;
}

export default function SuperAdminUsersPage() {
  const { data: session } = useSession();
  const viewerIsSuperAdmin = (session?.user as any)?.role === "SUPER_ADMIN";
  const [rows, setRows] = useState<UserRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    apiFetch<UserRow[]>("/api/super-admin/users")
      .then(({ data }) => setRows(Array.isArray(data) ? data : []))
      .catch(() => setRows([]));
  }, []);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return query
      ? rows.filter((u) => [u.name, u.email].some((f) => f?.toLowerCase().includes(query)))
      : rows;
  }, [rows, q]);

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
            {u.tenantName ?? u.tenantId.slice(0, 8)}
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
          <div className="relative w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by email or name…"
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent pl-9 pr-2.5 py-1 text-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus:outline-none"
            />
          </div>
        }
        right={<CsvExportButton url="/api/super-admin/users/export" />}
      />

      <DataTable
        columns={columns}
        rows={filtered}
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
    </div>
  );
}
