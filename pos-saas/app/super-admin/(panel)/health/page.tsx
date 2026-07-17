import Link from "next/link";
import { Activity, CheckCircle2, XCircle, Database, KeyRound } from "lucide-react";
import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { prisma } from "@/lib/prisma";
import { getAuditLogs } from "@/lib/audit-query";
import { formatDateTime } from "@/lib/format";
import { AuditActionBadge } from "@/components/super-admin/audit-action-badge";
import {
  PageHeader,
  StatGrid,
  MetricTile,
  DetailSection,
  DataTable,
  type Column,
} from "@/components/super-admin";

async function pingDb(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

const ENV_CHECKS: { key: string; label: string }[] = [
  { key: "DATABASE_URL", label: "Database URL" },
  { key: "AUTH_SECRET", label: "Auth secret" },
  { key: "MIDTRANS_SERVER_KEY", label: "Midtrans server key" },
  { key: "MIDTRANS_CLIENT_KEY", label: "Midtrans client key" },
  { key: "GOOGLE_CLIENT_ID", label: "Google OAuth (optional)" },
];

export default async function SuperAdminHealthPage() {
  await requireSuperAdminPanelSession();

  const [dbOk, recent] = await Promise.all([
    pingDb(),
    getAuditLogs({ page: 1, pageSize: 10 }),
  ]);

  const envStatus = ENV_CHECKS.map((c) => ({
    ...c,
    set: !!process.env[c.key],
  }));
  const envOk = envStatus.filter((c) => c.set).length;

  type Row = (typeof recent.rows)[number];

  const columns: Column<Row>[] = [
    {
      key: "time",
      header: "Time",
      render: (r) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
      ),
    },
    { key: "action", header: "Action", render: (r) => <AuditActionBadge action={r.action} /> },
    { key: "actor", header: "Actor", render: (r) => <span className="text-muted-foreground">{r.actorEmail}</span> },
    {
      key: "target",
      header: "Target",
      render: (r) => (
        <span className="font-mono text-xs text-muted-foreground">
          {r.targetType}:{r.targetId.slice(0, 8)}
        </span>
      ),
    },
  ];

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Monitor"
        title="System Health"
        subtitle="Live system checks — database, configuration, recent activity."
        icon={Activity}
        actions={
          <Link
            href="/super-admin/audit-log"
            className="text-xs text-primary hover:underline"
          >
            View full audit log →
          </Link>
        }
      />

      <StatGrid cols={2} className="mb-6">
        <MetricTile
          icon={Database}
          label="Database"
          value={dbOk ? "OK" : "Down"}
          tone={dbOk ? "success" : "danger"}
          sub={dbOk ? "Live ping via SELECT 1" : "Check connection / migrations"}
          index={0}
        />
        <MetricTile
          icon={KeyRound}
          label="Configuration"
          value={
            <>
              <span className="sa-tnum">{envOk}</span>
              <span className="text-muted-foreground">/{envStatus.length}</span>
            </>
          }
          sub="env vars set"
          tone={envOk === envStatus.length ? "success" : "warning"}
          index={1}
        />
      </StatGrid>

      <div className="mb-6">
        <DetailSection title="Environment Variables" icon={KeyRound}>
          <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            {envStatus.map((c) => (
              <li key={c.key} className="flex items-center gap-2">
                {c.set ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                )}
                <span className={c.set ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </DetailSection>
      </div>

      <DetailSection title="Recent Activity" icon={Activity}>
        <DataTable
          columns={columns}
          rows={recent.rows}
          getRowKey={(r) => r.id}
          emptyState={{ icon: Activity, title: "No events yet", hint: "Events will appear here." }}
        />
      </DetailSection>
    </div>
  );
}
