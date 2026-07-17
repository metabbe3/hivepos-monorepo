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
  Search,
  ArrowUpDown,
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
import { useDebounce } from "@/hooks/use-debounce";
import { useConfirm } from "@/components/shared/confirm-dialog";

interface ExpenseCategory {
  id: string;
  name: string;
}

// Local-calendar YYYY-MM-DD (NOT toISOString — that shifts to UTC and leaks the
// previous day into "today"/"this month"). Mirrors the orders page helper.
function fmtDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function getDateRange(from: string, to: string) {
  const today = new Date();
  let dateFrom = "";
  if (from === "today") dateFrom = fmtDay(today);
  else if (from === "week")
    dateFrom = fmtDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7)));
  else if (from === "month") dateFrom = fmtDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const dateTo = to === "today" ? fmtDay(today) : "";
  return { dateFrom, dateTo };
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

  const [search, setSearch] = useUrlState("search", "");
  const [filterCategory, setFilterCategory] = useUrlState("category", "all");
  const [rangeStr, setRangeStr] = useUrlState("range", "0");
  const [sortValue, setSortValue] = useUrlState("sort", "date_desc");
  const [customFrom, setCustomFrom] = useUrlState("from", "");
  const [customTo, setCustomTo] = useUrlState("to", "");
  const [expensePageStr, setExpensePageStr] = useUrlState("page", "1");
  const expensePage = parseInt(expensePageStr, 10) || 1;
  const debouncedSearch = useDebounce(search, 300);

  // Resolve the active date range (preset pills → bounds; custom → the two inputs).
  const DATE_RANGES = [
    { label: t("dateRange.all"), from: "", to: "" },
    { label: t("dateRange.today"), from: "today", to: "today" },
    { label: t("dateRange.thisWeek"), from: "week", to: "today" },
    { label: t("dateRange.thisMonth"), from: "month", to: "today" },
    { label: t("dateRange.custom"), from: "custom", to: "custom" },
  ];
  const dateRangeIdx = Math.max(0, Math.min(DATE_RANGES.length - 1, parseInt(rangeStr, 10) || 0));
  const { dateFrom, dateTo } =
    DATE_RANGES[dateRangeIdx].from === "custom"
      ? { dateFrom: customFrom, dateTo: customTo }
      : getDateRange(DATE_RANGES[dateRangeIdx].from, DATE_RANGES[dateRangeIdx].to);


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
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());
    if (filterCategory && filterCategory !== "all")
      params.set("categoryId", filterCategory);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, filterCategory, dateFrom, dateTo]);

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
    setSearch("");
    setFilterCategory("all");
    setRangeStr("0");
    setCustomFrom("");
    setCustomTo("");
  }

  const hasFilters =
    search !== "" ||
    filterCategory !== "all" ||
    dateRangeIdx !== 0 ||
    !!dateFrom ||
    !!dateTo;

  if (loading) return <PageLoading />;

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Sort the fetched set client-side (small per-branch set), then paginate.
  const sortedExpenses = [...expenses].sort((a, b) => {
    switch (sortValue) {
      case "date_asc":
        return a.date.localeCompare(b.date);
      case "amount_desc":
        return b.amount - a.amount;
      case "amount_asc":
        return a.amount - b.amount;
      default: // date_desc
        return b.date.localeCompare(a.date);
    }
  });

  // Paginate the table rows (the summary total still reflects ALL expenses).
  const EXPENSE_PAGE_SIZE = 25;
  const expenseTotalPages = Math.max(1, Math.ceil(sortedExpenses.length / EXPENSE_PAGE_SIZE));
  const safeExpensePage = Math.min(expensePage, expenseTotalPages);
  const pageExpenses = sortedExpenses.slice(
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

      {/* Filters — inline row, matches Orders/Customers */}
      <div className="bg-muted/30 border border-border/60 rounded-xl p-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("expenses.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-background border-border/60"
            />
          </div>

          {/* Category */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            aria-label={t("expenses.filterByCategory")}
            className="h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:border-ring appearance-none cursor-pointer"
          >
            <option value="all">{t("expenses.allCategories")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Date range pills */}
          <div className="flex gap-1 overflow-x-auto scrollbar-none">
            {DATE_RANGES.map((dr, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setRangeStr(String(i))}
                className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  dateRangeIdx === i
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {dr.label}
              </button>
            ))}
          </div>

          {/* Custom date inputs */}
          {DATE_RANGES[dateRangeIdx]?.from === "custom" && (
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="h-9 w-[150px] text-sm"
              />
              <span className="text-muted-foreground text-xs">—</span>
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="h-9 w-[150px] text-sm"
              />
            </div>
          )}

          {/* Sort */}
          <div className="relative">
            <ArrowUpDown className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={sortValue}
              onChange={(e) => setSortValue(e.target.value)}
              className="h-9 rounded-lg border border-border/60 bg-background pl-8 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="date_desc">{t("expenses.sortDateNew")}</option>
              <option value="date_asc">{t("expenses.sortDateOld")}</option>
              <option value="amount_desc">{t("expenses.sortAmountHigh")}</option>
              <option value="amount_asc">{t("expenses.sortAmountLow")}</option>
            </select>
          </div>

          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              {t("common.clear")}
            </Button>
          )}

          {/* Manage Categories */}
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
      </div>

      {sortedExpenses.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={hasFilters ? t("expenses.filtered") : t("expenses.noExpenses")}
          description={hasFilters ? t("expenses.filtered") : t("expenses.noExpensesDesc")}
          action={hasFilters ? undefined : { label: t("expenses.addExpense"), onClick: openCreate }}
        />
      ) : (
        <>
          {/* Summary — two stat tiles */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border/40 bg-card px-4 py-3 shadow-sm">
              <div className="text-xs font-medium text-muted-foreground">
                {t("expenses.count")}
              </div>
              <div className="mt-0.5 text-lg font-bold sa-tnum">
                {expenses.length}
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-card px-4 py-3 shadow-sm">
              <div className="text-xs font-medium text-muted-foreground">
                {t("expenses.total")}
              </div>
              <div className="mt-0.5 text-lg font-bold sa-tnum text-primary">
                {formatCurrency(totalExpenses)}
              </div>
            </div>
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
