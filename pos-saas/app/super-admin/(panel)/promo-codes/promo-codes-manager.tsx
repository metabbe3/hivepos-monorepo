"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Plus,
  Power,
  Gift,
  Percent,
  DollarSign,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { apiFetch, ApiClientError } from "@/modules/shared";

type PromoType = "FREE_MONTH" | "DISCOUNT_PERCENT" | "DISCOUNT_FIXED";
type ApplicablePlan = "" | "GROWTH" | "PRO";

interface PromoCode {
  id: string;
  code: string;
  description: string | null;
  type: PromoType;
  value: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  applicablePlan: string | null;
  createdAt: string;
}

const TYPE_META: Record<PromoType, { label: string; icon: typeof Gift; prefix: string; suffix: string }> = {
  FREE_MONTH: { label: "Free Month", icon: Gift, prefix: "", suffix: " bln" },
  DISCOUNT_PERCENT: { label: "Percent Off", icon: Percent, prefix: "", suffix: "%" },
  DISCOUNT_FIXED: { label: "Fixed Off", icon: DollarSign, prefix: "Rp ", suffix: "" },
};

const PLAN_LABEL: Record<string, string> = {
  PRO: "Pro only",
  GROWTH: "Growth only",
};

const EMPTY_FORM = {
  code: "",
  description: "",
  type: "FREE_MONTH" as PromoType,
  value: "",
  maxRedemptions: "",
  validUntil: "",
  applicablePlan: "" as ApplicablePlan,
};

export function PromoCodesManager() {
  const [codes, setCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<PromoCode | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const fetchCodes = useCallback(() => {
    setLoading(true);
    apiFetch<{ promoCodes: PromoCode[] }>("/api/super-admin/promo-codes")
      .then((r) => {
        setCodes(r.data?.promoCodes ?? []);
      })
      .catch((err) => {
        toast.error(err instanceof ApiClientError ? err.message : "Gagal memuat promo codes.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  }

  function openEdit(c: PromoCode) {
    setEditing(c);
    setForm({
      code: c.code,
      description: c.description ?? "",
      type: c.type,
      value: String(c.value),
      maxRedemptions: c.maxRedemptions === null ? "" : String(c.maxRedemptions),
      validUntil: c.validUntil ? c.validUntil.slice(0, 10) : "",
      applicablePlan: (c.applicablePlan ?? "") as ApplicablePlan,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditing(null);
    setForm({ ...EMPTY_FORM });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const value = Number(form.value);
    if (!editing) {
      const code = form.code.trim().toUpperCase();
      if (!code) {
        toast.error("Kode wajib diisi.");
        return;
      }
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast.error("Nilai harus lebih dari 0.");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await apiFetch("/api/super-admin/promo-codes", {
          method: "PUT",
          body: {
            id: editing.id,
            description: form.description.trim() || null,
            type: form.type,
            value,
            maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
            validUntil: form.validUntil || null,
            applicablePlan: form.applicablePlan || null,
          },
        });
        toast.success(`${editing.code} berhasil diperbarui.`);
      } else {
        const { data } = await apiFetch<{ promoCode: PromoCode }>("/api/super-admin/promo-codes", {
          method: "POST",
          body: {
            code: form.code.trim().toUpperCase(),
            description: form.description.trim() || undefined,
            type: form.type,
            value,
            maxRedemptions: form.maxRedemptions === "" ? null : Number(form.maxRedemptions),
            validUntil: form.validUntil || undefined,
            applicablePlan: form.applicablePlan || null,
          },
        });
        toast.success(`Promo ${data.promoCode.code} berhasil dibuat!`);
      }
      closeForm();
      fetchCodes();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(code: PromoCode) {
    try {
      const { data } = await apiFetch<{ promoCode: PromoCode }>("/api/super-admin/promo-codes", {
        method: "PATCH",
        body: { id: code.id, isActive: !code.isActive },
      });
      toast.success(`${code.code} ${data.promoCode.isActive ? "diaktifkan" : "dinonaktifkan"}.`);
      fetchCodes();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Terjadi kesalahan.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create button / form */}
      {!showForm ? (
        <Button
          onClick={openCreate}
          className="bg-brand-600 hover:bg-brand-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Buat Promo Code
        </Button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm p-6 space-y-4"
        >
          <h2 className="text-lg font-bold">
            {editing ? `Edit ${editing.code}` : "Promo Code Baru"}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Code</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="FREEMONTH"
                className="font-mono uppercase"
                disabled={!!editing}
                required={!editing}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Type</Label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as PromoType })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="FREE_MONTH">Free Month(s)</option>
                <option value="DISCOUNT_PERCENT">Percent Off</option>
                <option value="DISCOUNT_FIXED">Fixed Amount Off</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Value {form.type === "FREE_MONTH" ? "(bulan)" : form.type === "DISCOUNT_PERCENT" ? "(%)" : "(Rp)"}
              </Label>
              <Input
                type="number"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                placeholder={form.type === "FREE_MONTH" ? "1" : form.type === "DISCOUNT_PERCENT" ? "50" : "25000"}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Berlaku untuk paket
              </Label>
              <select
                value={form.applicablePlan}
                onChange={(e) => setForm({ ...form, applicablePlan: e.target.value as ApplicablePlan })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">Semua paket (Growth & Pro)</option>
                <option value="GROWTH">Growth only</option>
                <option value="PRO">Pro only</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Max Redemptions (kosong = unlimited)
              </Label>
              <Input
                type="number"
                value={form.maxRedemptions}
                onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
                placeholder="100"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">Description</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Promo tahun baru"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Valid Until (opsional)
              </Label>
              <Input
                type="date"
                value={form.validUntil}
                onChange={(e) => setForm({ ...form, validUntil: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700"
            >
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              {editing ? "Simpan" : "Buat"}
            </Button>
            <Button type="button" variant="outline" onClick={closeForm}>
              Batal
            </Button>
          </div>
        </form>
      )}

      {/* Codes table */}
      {codes.length === 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm p-12 text-center">
          <Gift className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">Belum ada promo code. Buat yang pertama!</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] bg-muted/30">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Code</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Type</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Value</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Paket</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Redemptions</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Valid Until</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {codes.map((c) => {
                  const meta = TYPE_META[c.type];
                  const Icon = meta.icon;
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-mono font-bold">{c.code}</div>
                        {c.description && (
                          <div className="text-xs text-muted-foreground">{c.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{meta.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {meta.prefix}
                        {c.value}
                        {meta.suffix}
                      </td>
                      <td className="px-4 py-3">
                        {c.applicablePlan ? (
                          <Badge variant="secondary">{PLAN_LABEL[c.applicablePlan] ?? c.applicablePlan}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Semua paket</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium">{c.redemptionCount}</span>
                        {c.maxRedemptions !== null && (
                          <span className="text-muted-foreground"> / {c.maxRedemptions}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {c.validUntil ? formatDate(c.validUntil) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={c.isActive ? "default" : "secondary"}>
                          {c.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1.5">
                          <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                            <Pencil className="mr-1.5 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => handleToggle(c)}>
                            <Power className="mr-1.5 h-3.5 w-3.5" />
                            {c.isActive ? "Nonaktifkan" : "Aktifkan"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
