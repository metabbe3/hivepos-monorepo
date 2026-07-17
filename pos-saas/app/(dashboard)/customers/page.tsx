"use client";

import { Suspense, useEffect, useState } from "react";
import { Search, ArrowUpDown, Inbox, UserPlus, Pencil, X, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { PageLoading } from "@/components/shared/loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useRole } from "@/hooks/use-role";
import { useGuardedPage } from "@/hooks/use-guarded-page";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { useDebounce } from "@/hooks/use-debounce";
import { useUrlState } from "@/hooks/use-url-filters";
import { DynamicForm } from "@/lib/forms";
import { customerSchema } from "@/lib/forms/schemas";
import { CustomerList } from "@/components/customers/customer-list";
import { ConfirmDeleteDialog } from "@/components/customers/confirm-delete-dialog";
import { ImportCustomersDialog } from "@/components/customers/import-customers-dialog";
import type { CustomerListItem } from "@/components/customers/types";

function CustomersContent() {
  const { isEmployee } = useRole();
  const { shouldRender } = useGuardedPage("customers", "read", "/laundry/orders");
  const { can } = usePermissions();
  const { t } = useTranslation();

  const canEdit = can("customers", "edit");
  const canDelete = can("customers", "delete");
  const canCreate = can("customers", "create");
  const importEnabled = useFeatureFlag("customersImportExport");

  const SORT_OPTIONS = [
    { value: "createdAt", label: t("customers.sortNewest") },
    { value: "name", label: t("customers.sortName") },
    { value: "orderCount", label: t("customers.sortOrders") },
    { value: "totalSpent", label: t("customers.sortSpent") },
    { value: "lastOrderDate", label: t("customers.sortLastOrder") },
  ];

  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useUrlState("search", "");
  const [sortBy, setSortBy] = useUrlState("sortBy", "createdAt");
  const [sortOrder, setSortOrder] = useUrlState("sortOrder", "desc");
  const [statusFilter, setStatusFilter] = useUrlState("status", "");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomerListItem | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // ponytail: 300ms debounce — parity with laundry/orders page. Without this,
  // typing "john" fires 4 requests (j, jo, joh, john) instead of 1.
  const debouncedSearch = useDebounce(search, 300);

  const buildParams = () => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (sortBy) params.set("sort", sortBy);
    if (sortOrder) params.set("order", sortOrder);
    if (statusFilter) params.set("status", statusFilter);
    return params.toString();
  };

  function refresh() {
    fetch(`/api/customers?${buildParams()}`)
      .then((r) => r.json())
      .then((res) => setCustomers(res.data ?? []));
  }

  useEffect(() => {
    fetch(`/api/customers?${buildParams()}`)
      .then((r) => r.json())
      .then((res) => setCustomers(res.data ?? []))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, sortBy, sortOrder, statusFilter]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(c: CustomerListItem) {
    setEditing(c);
    setDialogOpen(true);
  }

  function openDelete(c: CustomerListItem) {
    setDeleteTarget(c);
    setDeleteOpen(true);
  }

  if (loading || !shouldRender) return <PageLoading />;

  const hasFilter = search || statusFilter;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("customers.title")}
        description={t("customers.description")}
        action={canEdit ? { label: t("customers.addCustomer"), onClick: openCreate } : undefined}
      />

      {/* Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/30 p-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("customers.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors hover:text-foreground"
              aria-label={t("common.clear")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select
          value={statusFilter || "ALL"}
          onValueChange={(v) => setStatusFilter(!v || v === "ALL" ? "" : v)}
          items={[
            { value: "ALL", label: t("customers.allStatuses") },
            { value: "ACTIVE", label: t("status.active") },
            { value: "AT_RISK", label: t("status.atRisk") },
            { value: "LAPSED", label: t("status.lapsed") },
            { value: "NEW", label: t("status.new") },
          ]}
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("customers.allStatuses")}</SelectItem>
            <SelectItem value="ACTIVE">{t("status.active")}</SelectItem>
            <SelectItem value="AT_RISK">{t("status.atRisk")}</SelectItem>
            <SelectItem value="LAPSED">{t("status.lapsed")}</SelectItem>
            <SelectItem value="NEW">{t("status.new")}</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative">
          <ArrowUpDown className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Select value={sortBy} onValueChange={(v) => v && setSortBy(v)} items={SORT_OPTIONS}>
            <SelectTrigger className="h-9 w-[180px] pl-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
          title={sortOrder === "asc" ? t("customers.ascending") : t("customers.descending")}
        >
          <ArrowUpDown className={`h-4 w-4 transition-transform ${sortOrder === "desc" ? "rotate-180" : ""}`} />
        </Button>

        {canCreate && importEnabled && (
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />
            {t("customers.import")}
          </Button>
        )}
      </div>

      {customers.length === 0 ? (
        hasFilter ? (
          <EmptyState icon={Inbox} title={t("customers.noCustomersFilter")} />
        ) : (
          <EmptyState
            icon={Inbox}
            title={t("customers.noCustomers")}
            action={canEdit ? { label: t("customers.addCustomer"), onClick: openCreate } : undefined}
          />
        )
      ) : (
        <CustomerList
          customers={customers}
          isEmployee={isEmployee}
          onEdit={openEdit}
          onDelete={openDelete}
          canEdit={canEdit}
          canDelete={canDelete}
        />
      )}

      {/* Create / edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editing ? (
                <Pencil className="h-5 w-5 text-primary" />
              ) : (
                <UserPlus className="h-5 w-5 text-primary" />
              )}
              {editing ? t("customers.editCustomer") : t("customers.addCustomer")}
            </DialogTitle>
          </DialogHeader>
          <DynamicForm
            schema={customerSchema}
            initialData={
              editing
                ? {
                    name: editing.name,
                    phone: editing.phone,
                    email: editing.email || undefined,
                    notes: editing.notes || undefined,
                  }
                : undefined
            }
            recordId={editing?.id}
            onSuccess={() => {
              setDialogOpen(false);
              refresh();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <ConfirmDeleteDialog
        customer={deleteTarget}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onSuccess={() => {
          setDeleteTarget(null);
          refresh();
        }}
      />

      {canCreate && importEnabled && (
        <ImportCustomersDialog
          open={importOpen}
          onOpenChange={setImportOpen}
          onImported={refresh}
        />
      )}
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersContent />
    </Suspense>
  );
}
