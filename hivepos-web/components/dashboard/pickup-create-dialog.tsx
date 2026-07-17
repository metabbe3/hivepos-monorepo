"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface Branch {
  id: string;
  name: string;
  slug: string | null;
  pickupSlots?: unknown;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

type SlotDay = { day?: string; slots?: string[] };

function flattenSlots(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<string>();
  for (const day of raw as SlotDay[]) {
    if (Array.isArray(day?.slots)) for (const s of day.slots) set.add(s);
  }
  return Array.from(set);
}

function nextDates(count = 14, lang = "id"): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    out.push({
      value: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString(lang === "id" ? "id-ID" : "en-US", { weekday: "short", day: "numeric", month: "short" }),
    });
  }
  return out;
}

const DEFAULT_SLOTS = ["09:00-11:00", "11:00-13:00", "13:00-15:00", "15:00-17:00", "17:00-19:00"];

export function PickupCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const { t, lang } = useTranslation();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [custSearch, setCustSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");

  const [addressText, setAddressText] = useState("");
  const [requestedDate, setRequestedDate] = useState("");
  const [requestedSlot, setRequestedSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    apiFetch<Branch[]>("/api/branches")
      .then((res) => {
        const list = res.data || [];
        setBranches(list);
        if (!branchId && list[0]) setBranchId(list[0].id);
      })
      .catch(() => setBranches([]));
    apiFetch<Customer[]>("/api/customers?limit=100")
      .then((res) => setCustomers(res.data || []))
      .catch(() => setCustomers([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Reset on close.
  useEffect(() => {
    if (open) return;
    setSelectedCustomer(null);
    setCustSearch("");
    setAddressText("");
    setRequestedDate("");
    setRequestedSlot("");
    setNotes("");
  }, [open]);

  const filteredCustomers = useMemo(() => {
    const q = custSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 8);
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q))
      .slice(0, 8);
  }, [customers, custSearch]);

  const selectedBranch = branches.find((b) => b.id === branchId);
  const slots = flattenSlots(selectedBranch?.pickupSlots);
  const slotOptions = slots.length > 0 ? slots : DEFAULT_SLOTS;
  const dates = nextDates(14, lang);

  async function handleSubmit() {
    if (!selectedCustomer) {
      toast.error(t("pickup.toast.selectCustomer"));
      return;
    }
    if (!branchId) {
      toast.error(t("pickup.toast.selectOutlet"));
      return;
    }
    if (addressText.trim().length < 4) {
      toast.error(t("pickup.toast.addressMin"));
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/pickup-requests", {
        method: "POST",
        body: {
          customerId: selectedCustomer.id,
          branchId,
          addressText: addressText.trim(),
          requestedDate: requestedDate || undefined,
          requestedSlot: requestedSlot || undefined,
          notes: notes.trim() || undefined,
        },
      });
      toast.success(t("pickup.toast.created"));
      onOpenChange(false);
      onCreated();
    } catch (err) {
      if (err instanceof ApiClientError) toast.error(err.message);
      else toast.error(t("pickup.toast.failed"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("pickup.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Customer select */}
          <div className="space-y-1.5">
            <Label>{t("common.customer")}</Label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedCustomer.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {selectedCustomer.phone ?? "—"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setSelectedCustomer(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9 bg-muted/30 border-border/30"
                  placeholder={t("pickup.searchPlaceholder")}
                  value={custSearch}
                  onChange={(e) => {
                    setCustSearch(e.target.value);
                    setShowResults(true);
                  }}
                  onFocus={() => setShowResults(true)}
                  autoFocus
                />
                {showResults && filteredCustomers.length > 0 && (
                  <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border/30 bg-popover shadow-md max-h-56 overflow-y-auto">
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2.5 text-sm first:rounded-t-xl last:rounded-b-xl hover:bg-accent/60 transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setShowResults(false);
                          setCustSearch("");
                        }}
                      >
                        <span className="font-medium">{c.name}</span>
                        <span className="text-muted-foreground">{c.phone ?? "—"}</span>
                      </button>
                    ))}
                  </div>
                )}
                {showResults && custSearch && filteredCustomers.length === 0 && (
                  <div className="absolute top-full z-50 mt-1 w-full rounded-xl border border-border/30 bg-popover shadow-md p-3">
                    <p className="text-xs text-muted-foreground">
                      {t("pickup.customerNotFound")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Branch select */}
          <div className="space-y-1.5">
            <Label>{t("pickup.outlet")}</Label>
            <select
              className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {/* Address */}
          <div className="space-y-1.5">
            <Label>{t("pickup.addressLabel")}</Label>
            <Textarea
              className="bg-muted/30 border-border/30 min-h-[72px]"
              placeholder={t("pickup.addressPlaceholder")}
              value={addressText}
              onChange={(e) => setAddressText(e.target.value)}
            />
          </div>

          {/* Date + slot */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("common.date")}</Label>
              <select
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                value={requestedDate}
                onChange={(e) => setRequestedDate(e.target.value)}
              >
                <option value="">—</option>
                {dates.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("pickup.slot")}</Label>
              <select
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
                value={requestedSlot}
                onChange={(e) => setRequestedSlot(e.target.value)}
              >
                <option value="">—</option>
                {slotOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{t("pickup.notesLabel")}</Label>
            <Textarea
              className="bg-muted/30 border-border/30 min-h-[56px]"
              placeholder={t("pickup.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("pickup.title")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
