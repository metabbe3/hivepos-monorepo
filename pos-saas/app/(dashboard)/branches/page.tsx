"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  Plus,
  Pencil,
  Building2,
  Users,
  ShoppingCart,
  Sparkles,
  MapPin,
  AlertTriangle,
  Lock,
  CheckCircle2,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { CardListItem } from "@/components/shared/card-list";
import { CrudDialog } from "@/components/shared/crud-dialog";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useTranslation } from "@/hooks/use-translation";
import { DynamicForm } from "@/lib/forms/dynamic-form";
import { branchSchema } from "@/lib/forms/schemas";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  invoiceFooter: string | null;
  isActive: boolean;
  createdAt: string;
  coverageEnd: string | null;
  isFreeTier: boolean;
  counts: { users: number; orders: number; services: number; customers: number };
}

type CoverageStatus = "FREE" | "ACTIVE" | "EXPIRING" | "LOCKED";

function getCoverageStatus(branch: Pick<Branch, "isFreeTier" | "coverageEnd">): CoverageStatus {
  if (branch.isFreeTier) return "FREE";
  if (!branch.coverageEnd) return "LOCKED";
  const now = Date.now();
  const end = new Date(branch.coverageEnd).getTime();
  if (end <= now) return "LOCKED";
  const dayMs = 1000 * 60 * 60 * 24;
  const daysLeft = Math.ceil((end - now) / dayMs);
  if (daysLeft <= 30) return "EXPIRING";
  return "ACTIVE";
}

const COVERAGE_CONFIG: Record<CoverageStatus, { label: string; className: string }> = {
  FREE: {
    label: "FREE",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  },
  ACTIVE: {
    label: "AKTIF",
    className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  },
  EXPIRING: {
    label: "AKAN BERAKHIR",
    className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  },
  LOCKED: {
    label: "TERKUNCI",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  },
};

export default function BranchesPage() {
  const router = useRouter();
  const { allowed, isLoading: roleLoading } = usePermissionGuard("branches", "read");
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);

  useEffect(() => {
    if (roleLoading || !allowed) return;
    loadBranches();
  }, [roleLoading, allowed]);

  function loadBranches() {
    apiFetch<Branch[]>("/api/branches")
      .then((r) => setBranches(r.data))
      .catch(() => setBranches([]))
      .finally(() => setLoading(false));
  }

  if (roleLoading || !allowed) return null;
  if (loading) return <PageLoading />;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(b: Branch, e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setEditing(b);
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("branches.title")}
        description={t("branches.description")}
        action={{ label: t("branches.addBranch"), onClick: openCreate }}
      />

      {branches.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t("branches.noBranches")}
          description={t("branches.noBranchesDesc")}
          action={{ label: t("branches.addBranch"), onClick: openCreate }}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {branches.map((b) => {
            const covStatus = getCoverageStatus(b);
            const covConfig = COVERAGE_CONFIG[covStatus];
            const needsRenewal = covStatus === "LOCKED" || covStatus === "EXPIRING";

            return (
              <Link key={b.id} href={`/branches/${b.id}`}>
                <CardListItem
                  interactive
                  className={cn(
                    "cursor-pointer h-full",
                    !b.isActive && "opacity-60",
                    covStatus === "LOCKED" && "border-red-200 dark:border-red-900",
                  )}
                >
                  <CardContent className="pt-5 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[oklch(0.93_0.035_80)] dark:bg-[oklch(0.28_0.04_65)]">
                          <Building2 className="h-4 w-4 text-brand-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold truncate">{b.name}</p>
                          {b.address && (
                            <p className="text-xs text-muted-foreground truncate">{b.address}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={(e) => openEdit(b, e)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Coverage badge */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn("text-[10px]", covConfig.className)}>
                        {covStatus === "FREE" && <Sparkles className="h-3 w-3 mr-1" />}
                        {covStatus === "ACTIVE" && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {covStatus === "EXPIRING" && <AlertTriangle className="h-3 w-3 mr-1" />}
                        {covStatus === "LOCKED" && <Lock className="h-3 w-3 mr-1" />}
                        {covConfig.label}
                      </Badge>
                      {b.coverageEnd && !b.isFreeTier && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <CalendarClock className="h-3 w-3" />
                          {formatDate(b.coverageEnd)}
                        </span>
                      )}
                      {needsRenewal && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px] ml-auto"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            router.push("/billing");
                          }}
                        >
                          Perpanjang
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-brand-600" />
                        <div>
                          <p className="text-sm font-bold">{b.counts.users}</p>
                          <p className="text-[10px] text-muted-foreground">{t("branches.staff")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="h-3.5 w-3.5 text-[oklch(0.68_0.12_40)]" />
                        <div>
                          <p className="text-sm font-bold">{b.counts.orders}</p>
                          <p className="text-[10px] text-muted-foreground">{t("branches.orders")}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-[oklch(0.55_0.18_30)]" />
                        <div>
                          <p className="text-sm font-bold">{b.counts.services}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {t("branches.services")}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5 text-[oklch(0.75_0.10_95)]" />
                        <div>
                          <p className="text-sm font-bold">{b.counts.customers}</p>
                          <p className="text-[10px] text-muted-foreground">{t("branches.clients")}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </CardListItem>
              </Link>
            );
          })}
        </div>
      )}

      <CrudDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editing ? t("branches.editBranch") : t("branches.addBranch")}
        icon={<MapPin className="h-5 w-5 text-primary" />}
      >
        <DynamicForm
          schema={branchSchema}
          initialData={editing ? {
            name: editing.name,
            address: editing.address ?? "",
            phone: editing.phone ?? "",
            invoiceFooter: editing.invoiceFooter ?? "",
          } : undefined}
          recordId={editing?.id}
          onCancel={() => setDialogOpen(false)}
          onSuccess={() => {
            setDialogOpen(false);
            loadBranches();
          }}
        />
      </CrudDialog>
    </div>
  );
}
