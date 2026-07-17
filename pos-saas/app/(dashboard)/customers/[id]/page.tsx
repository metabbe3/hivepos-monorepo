"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, ShoppingCart, Sparkles, CreditCard, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BackButton } from "@/components/shared/back-button";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { usePermissions } from "@/hooks/use-permissions";
import { useTranslation } from "@/hooks/use-translation";
import { DynamicForm } from "@/lib/forms";
import { customerSchema } from "@/lib/forms/schemas";
import {
  CustomerDetailHeader,
} from "@/components/customers/customer-detail-header";
import { CustomerStatsGrid } from "@/components/customers/customer-stats-grid";
import { CustomerOrdersTab } from "@/components/customers/customer-orders-tab";
import { CustomerServicesTab } from "@/components/customers/customer-services-tab";
import { CustomerPaymentsTab } from "@/components/customers/customer-payments-tab";
import { CustomerWalletTab } from "@/components/customers/customer-wallet-tab";
import { TopUpDialog } from "@/components/customers/top-up-dialog";
import { ConfirmDeleteDialog } from "@/components/customers/confirm-delete-dialog";
import type {
  CustomerDetail,
  CustomerStats,
  DepositTransaction,
  PaymentHistoryRow,
} from "@/components/customers/types";

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const { allowed, isLoading: roleLoading } = usePermissionGuard("customers", "read", "/customers");
  const { can } = usePermissions();
  const { t } = useTranslation();

  const canEdit = can("customers", "edit");
  const canDelete = can("customers", "delete");
  // Top-up modifies the wallet balance, treat as edit-level permission.
  const canTopUp = can("customers", "edit");

  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [deposits, setDeposits] = useState<DepositTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [activeTab, setActiveTab] = useState("orders");

  const [editOpen, setEditOpen] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  // Resolve customer ID from params
  useEffect(() => {
    params.then(({ id }) => setCustomerId(id));
  }, [params]);

  const buildDateParams = () => {
    const q = new URLSearchParams();
    if (dateFrom) q.set("from", dateFrom);
    if (dateTo) q.set("to", dateTo);
    return q.toString();
  };

  // Fetch customer + stats together — ponytail: previously two effects on the
  // same deps, fired as separate re-renders. Promise.all collapses them.
  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    const q = buildDateParams();
    Promise.all([
      fetch(`/api/customers/${customerId}?${q}`).then((r) => r.json()),
      fetch(`/api/customers/${customerId}/stats?${q}`).then((r) => r.json()),
    ])
      .then(([c, s]) => {
        if (cancelled) return;
        setCustomer(c.data);
        if (s.data) setStats(s.data);
      })
      .catch(() => toast.error(t("customerDetails.failedLoad")))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, dateFrom, dateTo]);

  // Fetch deposit history
  const refreshDeposits = (id: string) => {
    fetch(`/api/customers/${id}/deposit`)
      .then((r) => r.json())
      .then((res) => setDeposits(res.data ?? []))
      .catch(() => {});
  };

  useEffect(() => {
    if (!customerId) return;
    refreshDeposits(customerId);
  }, [customerId]);

  function refresh() {
    if (!customerId) return;
    setSpinning(true);
    const q = buildDateParams();
    Promise.all([
      fetch(`/api/customers/${customerId}?${q}`).then((r) => r.json()),
      fetch(`/api/customers/${customerId}/stats?${q}`).then((r) => r.json()),
    ])
      .then(([c, s]) => {
        setCustomer(c.data);
        setStats(s.data);
      })
      .catch(() => toast.error(t("common.failedLoad")))
      .finally(() => setSpinning(false));
  }

  if (roleLoading || !allowed) return null;
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!customer) {
    return (
      <p className="py-12 text-center text-muted-foreground">
        {t("customers.notFound")}
      </p>
    );
  }

  const hasDateFilter = Boolean(dateFrom || dateTo);
  const allPayments: PaymentHistoryRow[] = customer.orders.flatMap((o) =>
    o.payments.map((p) => ({ ...p, orderNumber: o.orderNumber, orderId: o.id })),
  ).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const TABS = [
    { value: "orders", label: t("common.orders"), icon: ShoppingCart },
    { value: "services", label: t("customerDetails.services"), icon: Sparkles },
    { value: "payments", label: t("common.payment"), icon: CreditCard },
    { value: "wallet", label: t("deposit.wallet"), icon: Wallet },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <BackButton />
      <CustomerDetailHeader
        customer={customer}
        stats={stats}
        spinning={spinning}
        onEdit={() => setEditOpen(true)}
        onRefresh={refresh}
        onTopUp={() => setTopUpOpen(true)}
        onDelete={() => setDeleteOpen(true)}
        canEdit={canEdit}
        canDelete={canDelete}
        canTopUp={canTopUp}
      />

      {stats && (
        <CustomerStatsGrid
          stats={stats}
          balance={customer.balance ?? 0}
          canTopUp={canTopUp}
          onTopUp={() => setTopUpOpen(true)}
        />
      )}

      {/* Date filter row */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border/60 bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-muted-foreground">
            {t("common.from")}
          </Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full sm:w-[150px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="whitespace-nowrap text-muted-foreground">
            {t("common.to")}
          </Label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full sm:w-[150px]"
          />
        </div>
        {hasDateFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
            }}
          >
            {t("customerDetails.reset")}
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1 scrollbar-none">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <tab.icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <TabsContent value="orders">
          <CustomerOrdersTab
            orders={customer.orders}
            hasDateFilter={hasDateFilter}
          />
        </TabsContent>
        <TabsContent value="services">
          <CustomerServicesTab stats={stats} hasDateFilter={hasDateFilter} />
        </TabsContent>
        <TabsContent value="payments">
          <CustomerPaymentsTab
            payments={allPayments}
            stats={stats}
            hasDateFilter={hasDateFilter}
          />
        </TabsContent>
        <TabsContent value="wallet">
          <CustomerWalletTab deposits={deposits} />
        </TabsContent>
      </Tabs>

      {/* Edit dialog */}
      {canEdit && (
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5 text-primary" />
                {t("customers.editCustomer")}
              </DialogTitle>
            </DialogHeader>
            <DynamicForm
              schema={customerSchema}
              initialData={{
                name: customer.name,
                phone: customer.phone,
                email: customer.email || undefined,
                notes: customer.notes || undefined,
              }}
              recordId={customer.id}
              onSuccess={() => {
                setEditOpen(false);
                refresh();
              }}
              onCancel={() => setEditOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Top-up dialog */}
      {canTopUp && (
        <TopUpDialog
          open={topUpOpen}
          onOpenChange={setTopUpOpen}
          customerId={customer.id}
          onSuccess={() => {
            refresh();
            if (customerId) refreshDeposits(customerId);
          }}
        />
      )}

      {/* Delete confirmation — on success, navigate back to the list */}
      {canDelete && (
        <ConfirmDeleteDialog
          customer={{ id: customer.id, name: customer.name }}
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          onSuccess={() => {
            router.push("/customers");
          }}
          onEditInstead={() => {
            setEditOpen(true);
          }}
        />
      )}
    </div>
  );
}
