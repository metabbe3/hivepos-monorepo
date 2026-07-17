"use client";

import { useEffect, useState } from "react";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "sonner";
import {
  Pencil,
  Power,
  PowerOff,
  Package,
  ArrowUpDown,
  History,
  AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { CardListItem } from "@/components/shared/card-list";
import {
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DynamicForm } from "@/lib/forms";
import { stockItemSchema } from "@/lib/forms/schemas";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface StockItem {
  id: string;
  name: string;
  unit: string;
  currentQuantity: number;
  lowStockThreshold: number;
  purchasePricePerUnit: number;
  isActive: boolean;
}

interface StockMovement {
  id: string;
  type: "IN" | "OUT";
  quantity: number;
  notes: string | null;
  date: string;
  createdAt: string;
}

export default function InventoryPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [movementDialogOpen, setMovementDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [movementForm, setMovementForm] = useState({
    type: "IN" as "IN" | "OUT",
    quantity: "",
    notes: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const { allowed, isLoading: roleLoading } = usePermissionGuard("inventory", "read", "/laundry/orders");

  async function loadItems() {
    try {
      const res = await apiFetch<StockItem[]>("/api/stock-items");
      setItems(res.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadItems();
  }, []);

  if (roleLoading || !allowed) return null;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: StockItem) {
    setEditing(item);
    setDialogOpen(true);
  }

  function openMovement(item: StockItem) {
    setSelectedItem(item);
    setMovementForm({
      type: "IN",
      quantity: "",
      notes: "",
      date: new Date().toISOString().slice(0, 10),
    });
    setMovementDialogOpen(true);
  }

  async function openHistory(item: StockItem) {
    setSelectedItem(item);
    try {
      const res = await apiFetch<StockMovement[]>(`/api/stock-items/${item.id}/movements`);
      setMovements(res.data ?? []);
    } catch {
      setMovements([]);
    }
    setHistoryDialogOpen(true);
  }

  async function handleMovementSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem) return;

    try {
      await apiFetch(`/api/stock-items/${selectedItem.id}/movements`, {
        method: "POST",
        body: {
          type: movementForm.type,
          quantity: parseFloat(movementForm.quantity),
          notes: movementForm.notes || undefined,
          date: movementForm.date,
        },
      });
      toast.success(
        movementForm.type === "IN" ? t("inventory.stockAdded") : t("inventory.stockRemoved")
      );
      setMovementDialogOpen(false);
      loadItems();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("inventory.failedRecordMovement"));
    }
  }

  async function toggleActive(item: StockItem) {
    const ok = await confirm({
      title: item.isActive
        ? t("inventory.deactivateConfirmTitle")
        : t("inventory.activateConfirmTitle"),
      description: item.isActive
        ? t("inventory.deactivateConfirmDesc").replace("{name}", item.name)
        : t("inventory.activateConfirmDesc").replace("{name}", item.name),
      confirmLabel: item.isActive
        ? t("inventory.deactivate")
        : t("inventory.activate"),
      cancelLabel: t("common.cancel"),
      destructive: item.isActive,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/stock-items/${item.id}`, {
        method: "PATCH",
        body: { isActive: !item.isActive },
      });
      toast.success(item.isActive ? t("inventory.deactivated") : t("inventory.activated"));
      loadItems();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("inventory.failedUpdate"));
    }
  }

  if (loading) return <PageLoading />;

  const activeItems = items.filter((i) => i.isActive);
  const lowStockItems = activeItems.filter(
    (i) => i.currentQuantity <= i.lowStockThreshold
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("inventory.title")}
        description={t("inventory.description")}
        action={{ label: t("inventory.addItem"), onClick: openCreate }}
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Package}
          title={t("inventory.noStockItems")}
          description={t("inventory.noStockItemsDesc")}
          action={{ label: t("inventory.addItem"), onClick: openCreate }}
        />
      ) : (
        <>
          {lowStockItems.length > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-200/60 bg-amber-50/60 dark:border-amber-800/40 dark:bg-amber-900/20 px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <span className="text-sm text-amber-700 dark:text-amber-300">
                {t("inventory.lowStockAlert").replace("{count}", String(lowStockItems.length))}
              </span>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const isLow =
                item.isActive && item.currentQuantity <= item.lowStockThreshold;
              return (
                <CardListItem
                  key={item.id}
                  interactive
                  className={`${!item.isActive ? "opacity-60" : ""}`}
                >
                  <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                    <div className="flex items-start gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          isLow
                            ? "bg-red-50 dark:bg-red-900/30"
                            : "bg-teal-50 dark:bg-teal-900/30"
                        }`}
                      >
                        <Package
                          className={`h-4 w-4 ${
                            isLow
                              ? "text-red-500"
                              : "text-teal-600 dark:text-teal-400"
                          }`}
                        />
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {item.unit}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openMovement(item)}
                        title={t("inventory.recordMovement")}
                      >
                        <ArrowUpDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openHistory(item)}
                        title={t("inventory.movementHistory").split(" — ")[0]}
                      >
                        <History className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleActive(item)}
                        title={item.isActive
                          ? t("inventory.deactivate")
                          : t("inventory.activate")}
                      >
                        {item.isActive
                          ? <PowerOff className="h-3.5 w-3.5" />
                          : <Power className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-2xl font-bold">
                          {item.currentQuantity}
                        </span>
                        <span className="text-sm text-muted-foreground ml-1">
                          {item.unit}
                        </span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm text-muted-foreground">
                          {formatCurrency(item.purchasePricePerUnit)}/{item.unit}
                        </span>
                        {isLow && (
                          <Badge className="bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300">
                            {t("inventory.lowStock")}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </CardListItem>
              );
            })}
          </div>
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {editing ? t("inventory.editItem") : t("inventory.addItem")}
            </DialogTitle>
          </DialogHeader>
          <DynamicForm 
            schema={stockItemSchema} 

            initialData={editing ? {
              name: editing.name,
              unit: editing.unit,
              currentQuantity: Number(editing.currentQuantity),
              lowStockThreshold: editing.lowStockThreshold || 0,
              purchasePricePerUnit: Number(editing.purchasePricePerUnit) || 0,
            } : undefined}

            recordId={editing?.id} 
            onSuccess={() => {
              setDialogOpen(false);
              loadItems();
            }} 
            onCancel={() => setDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={movementDialogOpen} onOpenChange={setMovementDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="h-5 w-5 text-primary" />
              {t("inventory.stockMovement").replace("{name}", selectedItem?.name ?? "")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMovementSubmit} className="space-y-4">
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("common.status")}</Label>
              <Select
                value={movementForm.type}
                onValueChange={(v) =>
                  v &&
                  setMovementForm({
                    ...movementForm,
                    type: v as "IN" | "OUT",
                  })
                }
                items={[
                  { value: "IN", label: t("inventory.stockIn") },
                  { value: "OUT", label: t("inventory.stockOut") },
                ]}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="IN">{t("inventory.stockIn")}</SelectItem>
                  <SelectItem value="OUT">{t("inventory.stockOut")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("common.quantity")} ({selectedItem?.unit})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={movementForm.quantity}
                  onChange={(e) =>
                    setMovementForm({
                      ...movementForm,
                      quantity: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("common.date")}</Label>
                <Input
                  type="date"
                  value={movementForm.date}
                  onChange={(e) =>
                    setMovementForm({ ...movementForm, date: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("common.notes")}</Label>
              <Textarea
                value={movementForm.notes}
                onChange={(e) =>
                  setMovementForm({ ...movementForm, notes: e.target.value })
                }
                placeholder={t("common.optionalNotes")}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="w-full sm:w-auto bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105"
              >
                <ArrowUpDown className="h-4 w-4 mr-2" />
                {t("inventory.recordMovement")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Movement History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              {t("inventory.movementHistory").replace("{name}", selectedItem?.name ?? "")}
            </DialogTitle>
          </DialogHeader>
          {movements.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              {t("inventory.noMovements")}
            </p>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-2">
              {movements.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2.5"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      className={
                        m.type === "IN"
                          ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-red-100/80 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                      }
                    >
                      {m.type === "IN" ? t("inventory.typeIn") : t("inventory.typeOut")}
                    </Badge>
                    <div>
                      <span className="text-sm font-medium">
                        {m.quantity} {selectedItem?.unit}
                      </span>
                      {m.notes && (
                        <p className="text-xs text-muted-foreground">
                          {m.notes}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(m.date)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
