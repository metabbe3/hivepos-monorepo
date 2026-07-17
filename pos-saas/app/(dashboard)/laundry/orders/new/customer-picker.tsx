"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { X, Search, UserPlus, User, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useOnlineStatus } from "@/lib/offline/use-online-status";
import { newClientId } from "@/lib/offline/client-id";
import { putPendingCustomer } from "@/lib/offline/db";
import { useDebounce } from "@/hooks/use-debounce";
import { useTranslation } from "@/hooks/use-translation";
import { formatCurrency } from "@/lib/format";
import { useNewOrder, type Customer } from "./new-order-context";

// ponytail: customer-section UI state (search, inline create) is local — only
// the resulting selectedCustomer propagates via context. The combobox opens on
// TYPE only (never on mount/focus), is debounced + capped, and "Tambah pelanggan
// baru" expands an inline form instead of a modal — calm, no jank.

const MAX_RESULTS = 8;

/** Bold the matched substring inside a result label. */
function Highlight({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent font-semibold text-foreground">
        {text.slice(idx, idx + query.length)}
      </mark>
      {text.slice(idx + query.length)}
    </>
  );
}

export function CustomerPicker() {
  const { customers, setCustomers, selectedCustomer, setSelectedCustomer } =
    useNewOrder();
  const { t } = useTranslation();
  const online = useOnlineStatus();

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 250);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [custForm, setCustForm] = useState({ name: "", phone: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close the results popover on outside click.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!(e.target as HTMLElement).closest("[data-customer-picker]")) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const results = debouncedQuery
    ? customers
        .filter(
          (c) =>
            c.name.toLowerCase().includes(debouncedQuery.toLowerCase()) ||
            c.phone.includes(debouncedQuery),
        )
        .slice(0, MAX_RESULTS)
    : [];

  function select(c: Customer) {
    setSelectedCustomer(c);
    setQuery("");
    setOpen(false);
  }

  function startCreate(prefill?: string) {
    setCreating(true);
    setOpen(false);
    setCustForm({ name: prefill && prefill.trim() ? prefill.trim() : "", phone: "" });
    setQuery("");
  }

  async function handleCreateCustomer(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!custForm.name.trim()) {
      toast.error(t("newOrder.failedCreateCustomer"));
      return;
    }
    setSavingCustomer(true);
    try {
      // Offline: stash in IDB + surface as a synthetic local customer.
      if (!online) {
        const clientId = newClientId();
        await putPendingCustomer({
          clientId,
          status: "pending",
          payload: { name: custForm.name.trim(), phone: custForm.phone.trim() || null },
          createdAt: new Date().toISOString(),
        });
        const synthetic: Customer = {
          id: `pending:${clientId}`,
          name: custForm.name.trim(),
          phone: custForm.phone.trim(),
          balance: 0,
          pendingClientId: clientId,
        };
        setCustomers((prev) => [...prev, synthetic]);
        setSelectedCustomer(synthetic);
        toast.success(t("offline.createdOffline"));
      } else {
        const { data: customer } = await apiFetch<Customer>("/api/customers", {
          method: "POST",
          body: custForm,
        });
        setCustomers((prev) => [...prev, customer]);
        setSelectedCustomer(customer);
        toast.success(t("newOrder.customerCreated"));
      }
      setCreating(false);
      setCustForm({ name: "", phone: "" });
    } catch (err) {
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : t("newOrder.failedCreateCustomer"),
      );
    } finally {
      setSavingCustomer(false);
    }
  }

  // Enter submits the inline create. The create UI is a <div>, not a nested
  // <form> — nesting it inside the outer order <form> is invalid HTML and
  // previously let the submit bubble up to handleSubmit, wiping the cart.
  function handleCustKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      void handleCreateCustomer();
    }
  }

  // ── Selected state: a confident customer card ──
  if (selectedCustomer) {
    return (
      <Card className="animate-fade-in-up border border-border/40 bg-card shadow-sm rounded-xl">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">
            {t("common.customer")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/[0.04] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <User className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium">{selectedCustomer.name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                  {(selectedCustomer.balance ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                      <Wallet className="h-3 w-3" />
                      {formatCurrency(selectedCustomer.balance ?? 0)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-primary"
                onClick={() => {
                  setSelectedCustomer(null);
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
              >
                {t("newOrder.changeCustomer")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setSelectedCustomer(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Search / create state ──
  return (
    <Card className="border border-border/40 bg-card shadow-sm rounded-xl overflow-visible">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">
          {t("common.customer")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!creating ? (
          <div className="relative" data-customer-picker>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={inputRef}
              className="h-11 pl-9 pr-24 bg-muted/30 border-border/40"
              placeholder={t("newOrder.searchPlaceholder")}
              value={query}
              // Open ONLY while typing a non-empty query — never on focus/mount.
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(e.target.value.trim().length > 0);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setOpen(false);
                  setQuery("");
                } else if (e.key === "Enter") {
                  e.preventDefault();
                  if (results.length > 0) select(results[0]);
                  else if (query.trim()) startCreate(query);
                }
              }}
            />
            <button
              type="button"
              onClick={() => startCreate()}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
            >
              <UserPlus className="h-3.5 w-3.5" />
              {t("newOrder.addNewCustomer")}
            </button>

            {open && results.length > 0 && (
              <div className="absolute top-full z-50 mt-1.5 w-full animate-in fade-in-0 zoom-in-95 overflow-hidden rounded-xl border border-border/40 bg-popover shadow-lg max-h-64 overflow-y-auto">
                {results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/60 first:pt-3 last:pb-3"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(c)}
                  >
                    <span className="min-w-0 truncate font-medium">
                      <Highlight text={c.name} query={debouncedQuery} />
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {c.phone || "—"}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {open && debouncedQuery && results.length === 0 && (
              <div className="absolute top-full z-50 mt-1.5 w-full animate-in fade-in-0 zoom-in-95 rounded-xl border border-border/40 bg-popover p-3 shadow-lg">
                <p className="mb-2 text-xs text-muted-foreground">
                  {t("newOrder.noCustomerFound")}
                </p>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => startCreate(debouncedQuery)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  {t("newOrder.newCustomer")} “{debouncedQuery}”
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-in fade-in-0 slide-in-from-bottom-2 space-y-3 rounded-xl border border-border/40 bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
                <UserPlus className="h-4 w-4 text-primary" />
                {t("newOrder.newCustomer")}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => {
                  setCreating(false);
                  setCustForm({ name: "", phone: "" });
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t("common.name")}
                </Label>
                <Input
                  placeholder={t("newOrder.namePlaceholder")}
                  value={custForm.name}
                  onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                  onKeyDown={handleCustKeyDown}
                  className="bg-background"
                  autoFocus
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {t("common.phone")}
                </Label>
                <Input
                  placeholder={t("newOrder.phonePlaceholder")}
                  value={custForm.phone}
                  onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                  onKeyDown={handleCustKeyDown}
                  className="bg-background"
                />
              </div>
            </div>
            <Button
              type="button"
              onClick={() => void handleCreateCustomer()}
              className="w-full bg-gradient-to-r from-brand-600 to-brand-700 font-semibold text-white shadow-md shadow-brand-600/15 transition-all hover:brightness-105"
              disabled={!custForm.name.trim() || savingCustomer}
            >
              {savingCustomer ? t("common.saving") : t("newOrder.createAndSelect")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
