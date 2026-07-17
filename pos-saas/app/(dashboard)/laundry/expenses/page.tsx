"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { useTranslation } from "@/hooks/use-translation";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  Receipt,
  Tag,
  X,
  Filter,
  DollarSign,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { SimplePagination } from "@/components/shared/simple-pagination";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { expenseSchema } from "@/lib/forms/schemas";
import type { FormSchema } from "@/lib/forms/types";

// The create/edit form only mounts when its dialog opens (base-ui Dialog
// lazily mounts its content). Dynamic-importing it keeps DynamicForm + its
// field renderers out of the expenses route's initial bundle → lower FCP.
const DynamicForm = dynamic(
  () => import("@/lib/forms/dynamic-form").then((m) => ({ default: m.DynamicForm })),
  {
    ssr: false,
    loading: () => (
      <div className="py-10 text-center text-sm text-muted-foreground">…</div>
    ),
  },
);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useUrlState } from "@/hooks/use-url-filters";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface ExpenseCategory {
  id: string;
  name: string;
}

interface Expense {
  id: string;
  amount: number;
  description: string | null;
  date: string;
  categoryId: string;
  category: ExpenseCategory;
}

// ponytail: inline-create category field. The page already owns `categories`
// state + loadCategories(); this component renders the Select and a "+ New"
// popover that POSTs a category, refreshes the list, and auto-selects it.
function CategoryField({
  value,
  onChange,
  disabled,
  categories,
  onCreated,
}: {
  value: unknown;
  onChange: (v: unknown) => void;
  disabled: boolean;
  categories: ExpenseCategory[];
  onCreated: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const { data } = await apiFetch<ExpenseCategory>(
        "/api/expense-categories",
        { method: "POST", body: { name } },
      );
      await onCreated(); // refresh page-level categories state
      onChange(data.id); // auto-select the new category in the form
      setName("");
      setOpen(false);
      toast.success(t("expenses.categoryAdded"));
    } catch (err) {
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : t("expenses.failedCreateCategory"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-2">
      <Select
        value={String(value ?? "")}
        onValueChange={onChange}
        disabled={disabled}
        items={categories.map((c) => ({ label: c.name, value: c.id }))}
      >
        <SelectTrigger className="flex-1">
          <SelectValue placeholder="Pilih kategori" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              disabled={disabled}
              aria-label={t("expenses.newCategoryName")}
            >
              <Plus className="h-4 w-4" />
            </Button>
          }
        />
        <PopoverContent align="end" className="w-56">
          <form onSubmit={handleCreate} className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {t("expenses.newCategoryName")}
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("expenses.newCategoryName")}
              autoFocus
              disabled={saving}
            />
            <Button
              type="submit"
              size="sm"
              className="w-full"
              disabled={saving || !name.trim()}
            >
              {saving ? t("common.saving") : t("common.create")}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ExpensesContent() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [filterCategory, setFilterCategory] = useUrlState("category", "all");
  const [filterFrom, setFilterFrom] = useUrlState("from", "");
  const [filterTo, setFilterTo] = useUrlState("to", "");
  const [expensePageStr, setExpensePageStr] = useUrlState("page", "1");
  const expensePage = parseInt(expensePageStr, 10) || 1;

  const { allowed, isLoading: roleLoading } = usePermissionGuard("expenses", "read", "/laundry/orders");

  async function loadCategories() {
    try {
      const res = await apiFetch<ExpenseCategory[]>("/api/expense-categories");
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCategories([]);
    }
  }

  async function loadExpenses() {
    const params = new URLSearchParams();
    if (filterCategory && filterCategory !== "all")
      params.set("categoryId", filterCategory);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);

    try {
      const res = await apiFetch<Expense[]>(`/api/expenses?${params.toString()}`);
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch {
      setExpenses([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    setExpensePageStr("1"); // filters changed → back to first page
    loadExpenses();
  }, [filterCategory, filterFrom, filterTo]);

  // ponytail: override the category field with a render that uses the page's
  // categories state + a "+ New" popover. Schema endpoint stays as a fallback.
  const expenseSchemaWithCreate = useMemo<FormSchema>(
    () => ({
      ...expenseSchema,
      fields: expenseSchema.fields.map((f) =>
        f.name === "categoryId"
          ? {
              ...f,
              optionsEndpoint: undefined, // page supplies options via render
              render: ({ value, onChange, disabled }) => (
                <CategoryField
                  value={value}
                  onChange={onChange}
                  disabled={disabled}
                  categories={categories}
                  onCreated={loadCategories}
                />
              ),
            }
          : f,
      ),
    }),
    [categories],
  );

  if (roleLoading || !allowed) return null;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setDialogOpen(true);
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: t("expenses.deleteConfirmTitle"),
      description: t("expenses.deleteConfirmDesc"),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/expenses/${id}`, { method: "DELETE" });
      toast.success(t("expenses.deleted"));
      loadExpenses();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("expenses.failedDelete"));
    }
  }

  async function handleAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    try {
      await apiFetch("/api/expense-categories", {
        method: "POST",
        body: { name: newCategoryName },
      });
      toast.success(t("expenses.categoryAdded"));
      setNewCategoryName("");
      loadCategories();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("expenses.failedCreateCategory"));
    }
  }

  async function handleDeleteCategory(id: string) {
    const ok = await confirm({
      title: t("expenses.deleteCategoryConfirmTitle"),
      description: t("expenses.deleteCategoryConfirmDesc"),
      confirmLabel: t("common.delete"),
      cancelLabel: t("common.cancel"),
      destructive: true,
    });
    if (!ok) return;
    try {
      await apiFetch(`/api/expense-categories/${id}`, { method: "DELETE" });
      toast.success(t("expenses.categoryDeleted"));
      loadCategories();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("expenses.failedDeleteCategory"));
    }
  }

  function clearFilters() {
    setFilterCategory("all");
    setFilterFrom("");
    setFilterTo("");
  }

  const hasFilters =
    filterCategory !== "all" || filterFrom || filterTo;
  const activeFilterCount = [
    filterCategory !== "all",
    !!filterFrom,
    !!filterTo,
  ].filter(Boolean).length;

  if (loading) return <PageLoading />;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Paginate the table rows (the summary total still reflects ALL expenses).
  const EXPENSE_PAGE_SIZE = 25;
  const expenseTotalPages = Math.max(1, Math.ceil(expenses.length / EXPENSE_PAGE_SIZE));
  const safeExpensePage = Math.min(expensePage, expenseTotalPages);
  const pageExpenses = expenses.slice(
    (safeExpensePage - 1) * EXPENSE_PAGE_SIZE,
    safeExpensePage * EXPENSE_PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("expenses.title")}
        description={t("expenses.description")}
        action={{ label: t("expenses.addExpense"), onClick: openCreate }}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover>
          <PopoverTrigger
            render={
              <Button variant={hasFilters ? "default" : "outline"} size="sm">
                <Filter className="mr-1.5 h-3.5 w-3.5" />
                {t("common.filters")}
                {activeFilterCount > 0 && (
                  <Badge className="ml-1.5 h-4 min-w-4 px-1 justify-center bg-brand-600 text-white text-[10px] leading-none">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            }
          />
          <PopoverContent align="start" className="w-72">
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  {t("common.category")}
                </Label>
                <Select
                  value={filterCategory}
                  onValueChange={(v) => setFilterCategory(v ?? "all")}
                  items={[
                    { value: "all", label: t("expenses.allCategories") },
                    ...categories.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("expenses.allCategories")}
                    </SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t("common.from")}
                  </Label>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    {t("common.to")}
                  </Label>
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                  />
                </div>
              </div>
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="w-full"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  {t("common.clear")}
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCategoryDialogOpen(true)}
          className="ml-auto"
        >
          <Tag className="mr-1.5 h-3.5 w-3.5" />
          {t("expenses.manageCategories")}
        </Button>
      </div>

      {expenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={t("expenses.noExpenses")}
          description={t("expenses.noExpensesDesc")}
          action={{ label: t("expenses.addExpense"), onClick: openCreate }}
        />
      ) : (
        <>
          {/* Summary */}
          <div className="flex items-center justify-between rounded-lg border border-border/40 bg-card px-4 py-3 shadow-sm">
            <span className="text-sm text-muted-foreground">
              {t("expenses.expenseCount").replace("{count}", String(expenses.length))}
            </span>
            <span className="text-lg font-bold">
              {formatCurrency(totalExpenses)}
            </span>
          </div>

          {/* Table */}
          <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.date")}</TableHead>
                  <TableHead>{t("common.category")}</TableHead>
                  <TableHead>{t("common.description")}</TableHead>
                  <TableHead className="text-right">{t("common.amount")}</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageExpenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="text-sm">
                      {formatDate(expense.date)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="border-border/60">
                        {expense.category?.name ?? "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {expense.description || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(expense)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleDelete(expense.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <SimplePagination
            page={safeExpensePage}
            totalPages={expenseTotalPages}
            onPageChange={(p: number) => setExpensePageStr(String(p))}
            total={expenses.length}
          />
        </>
      )}

      {/* Create/Edit Expense Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              {editing ? t("expenses.editExpense") : t("expenses.addExpense")}
            </DialogTitle>
          </DialogHeader>
          <DynamicForm
            schema={expenseSchemaWithCreate}
            initialData={
              editing
                ? {
                    amount: Number(editing.amount),
                    categoryId: editing.category?.id,
                    date: editing.date?.split("T")[0],
                    description: editing.description,
                  }
                : undefined
            }
            recordId={editing?.id}
            onSuccess={() => {
              setDialogOpen(false);
              loadExpenses();
            }}
            onCancel={() => setDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Category Management Dialog */}
      <Dialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      >
        <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("branchDetails.expenseCategories")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddCategory} className="flex gap-2">
            <Input
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder={t("expenses.newCategoryName")}
              className="flex-1"
            />
            <Button
              type="submit"
              size="sm"
              className="bg-gradient-to-r from-brand-600 to-brand-700"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
            {categories.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2"
              >
                <span className="text-sm">{c.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDeleteCategory(c.id)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {categories.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                {t("expenses.noCategories")}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense>
      <ExpensesContent />
    </Suspense>
  );
}
