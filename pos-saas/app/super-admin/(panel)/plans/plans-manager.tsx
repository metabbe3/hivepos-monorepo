"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import {
  Loader2,
  Plus,
  Power,
  Pencil,
  Trash2,
  Users as UsersIcon,
  Building2,
  ShoppingBag,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  maxOutlets: number;
  maxUsers: number;
  maxOrders: number;
  priceMonthly: number;
  priceYearly: number;
  modules: string[];
  features: any;
  tier: string | null;
  isActive: boolean;
  subscriptionCount: number;
  createdAt: string;
}

const MODULE_OPTIONS = ["laundry", "salon", "cleaning", "fnb"];

const EMPTY_FORM = {
  name: "",
  description: "",
  maxOutlets: "1",
  maxUsers: "2",
  maxOrders: "100",
  priceMonthly: "0",
  priceYearly: "0",
  modules: [] as string[],
  tier: "" as "" | "FREE" | "GROWTH" | "PRO",
  website: false,
};

export function PlansManager() {
  const confirm = useConfirm();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchPlans = useCallback(() => {
    setLoading(true);
    apiFetch<{ plans: Plan[] }>("/api/super-admin/plans")
      .then((r) => setPlans(r.data?.plans ?? []))
      .catch((err) => {
        toast.error(err instanceof ApiClientError ? err.message : "Gagal memuat plans.");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function startEdit(p: Plan) {
    setEditing(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      maxOutlets: String(p.maxOutlets),
      maxUsers: String(p.maxUsers),
      maxOrders: String(p.maxOrders),
      priceMonthly: String(p.priceMonthly),
      priceYearly: String(p.priceYearly),
      modules: p.modules,
      tier: (p.tier ?? "") as "" | "FREE" | "GROWTH" | "PRO",
      website: !!p.features?.website,
    });
    setShowForm(true);
  }

  function startCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      toast.error("Nama wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const body = {
        name,
        description: form.description.trim() || undefined,
        maxOutlets: Number(form.maxOutlets),
        maxUsers: Number(form.maxUsers),
        maxOrders: Number(form.maxOrders),
        priceMonthly: Number(form.priceMonthly),
        priceYearly: Number(form.priceYearly),
        modules: form.modules,
        tier: form.tier || undefined,
        features: { ...(editing?.features ?? {}), website: form.website },
      };

      if (editing) {
        await apiFetch(`/api/super-admin/plans/${editing.id}`, {
          method: "PATCH",
          body,
        });
        toast.success(`Plan "${name}" diperbarui.`);
      } else {
        await apiFetch("/api/super-admin/plans", { method: "POST", body });
        toast.success(`Plan "${name}" dibuat.`);
      }
      cancelForm();
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(p: Plan) {
    try {
      await apiFetch(`/api/super-admin/plans/${p.id}`, {
        method: "PATCH",
        body: { isActive: !p.isActive },
      });
      toast.success(`${p.name} ${p.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal mengubah status.");
    }
  }

  async function handleDelete(p: Plan) {
    if (!(await confirm({
      title: "Hapus plan?",
      description: `Hapus plan "${p.name}"? Tidak bisa dibatalkan.`,
      destructive: true,
    }))) return;
    try {
      await apiFetch(`/api/super-admin/plans/${p.id}`, { method: "DELETE" });
      toast.success(`Plan "${p.name}" dihapus.`);
      fetchPlans();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menghapus.");
    }
  }

  function toggleModule(m: string) {
    setForm((prev) => ({
      ...prev,
      modules: prev.modules.includes(m)
        ? prev.modules.filter((x) => x !== m)
        : [...prev.modules, m],
    }));
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
      {!showForm ? (
        <Button
          onClick={startCreate}
          className="bg-brand-600 hover:bg-brand-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Buat Plan
        </Button>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">
              {editing ? `Edit Plan: ${editing.name}` : "Plan Baru"}
            </h2>
            <button type="button" onClick={cancelForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Pro" required />
            </FormField>

            <FormField label="Description">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Untuk bisnis menengah" />
            </FormField>

            <FormField label="Price Monthly (Rp)">
              <Input type="number" min={0} value={form.priceMonthly} onChange={(e) => setForm({ ...form, priceMonthly: e.target.value })} required />
            </FormField>

            <FormField label="Price Yearly (Rp)">
              <Input type="number" min={0} value={form.priceYearly} onChange={(e) => setForm({ ...form, priceYearly: e.target.value })} required />
            </FormField>

            <FormField label="Max Outlets">
              <Input type="number" min={1} value={form.maxOutlets} onChange={(e) => setForm({ ...form, maxOutlets: e.target.value })} required />
            </FormField>

            <FormField label="Max Users">
              <Input type="number" min={1} value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: e.target.value })} required />
            </FormField>

            <FormField label="Max Orders / month">
              <Input type="number" min={0} value={form.maxOrders} onChange={(e) => setForm({ ...form, maxOrders: e.target.value })} required />
            </FormField>

            <FormField label="Modules">
              <div className="flex flex-wrap gap-2 pt-1.5">
                {MODULE_OPTIONS.map((m) => {
                  const active = form.modules.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleModule(m)}
                      className={`rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "border-brand-500 bg-brand-500 text-white"
                          : "border-[var(--color-border)] bg-transparent hover:bg-muted"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </FormField>

            <FormField label="Tier (billing)">
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value as "" | "FREE" | "GROWTH" | "PRO" })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="">— (infer from name)</option>
                <option value="FREE">FREE</option>
                <option value="GROWTH">GROWTH</option>
                <option value="PRO">PRO</option>
              </select>
            </FormField>

            <FormField label="Website (Pro feature)">
              <button
                type="button"
                onClick={() => setForm({ ...form, website: !form.website })}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  form.website
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-[var(--color-border)] bg-transparent hover:bg-muted"
                }`}
              >
                {form.website ? "Website ON" : "Website OFF"}
              </button>
            </FormField>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              {editing ? "Simpan" : "Buat"}
            </Button>
            <Button type="button" variant="outline" onClick={cancelForm}>Batal</Button>
          </div>
        </form>
      )}

      {plans.length === 0 ? (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm p-12 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-muted-foreground">Belum ada plan. Buat yang pertama!</p>
        </div>
      ) : (
        <div className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--color-border)] bg-muted/30">
                <tr className="text-left">
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Plan</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Price</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Limits</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Modules</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Tenants</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground">Status</th>
                  <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {plans.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{p.name}</span>
                        {p.tier && <Badge variant="outline" className="text-[10px]">{p.tier}</Badge>}
                        {p.features?.website && <Badge variant="secondary" className="text-[10px]">WEBSITE</Badge>}
                      </div>
                      {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">Rp {p.priceMonthly.toLocaleString("id-ID")}/bln</div>
                      <div className="text-xs text-muted-foreground">Rp {p.priceYearly.toLocaleString("id-ID")}/thn</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="flex items-center gap-1"><Building2 className="h-3 w-3" />{p.maxOutlets} outlet</div>
                      <div className="flex items-center gap-1"><UsersIcon className="h-3 w-3" />{p.maxUsers} user</div>
                      <div className="flex items-center gap-1"><ShoppingBag className="h-3 w-3" />{p.maxOrders} order</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {p.modules.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          p.modules.map((m) => (
                            <Badge key={m} variant="secondary" className="text-xs">{m}</Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{p.subscriptionCount}</td>
                    <td className="px-4 py-3">
                      <Badge variant={p.isActive ? "default" : "secondary"}>
                        {p.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => startEdit(p)} title="Edit">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleToggle(p)} title={p.isActive ? "Nonaktifkan" : "Aktifkan"}>
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(p)} title="Hapus" disabled={p.subscriptionCount > 0}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}{required && " *"}
      </Label>
      {children}
    </div>
  );
}
