"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Loader2, Plus, Trash2, Shield, LifeBuoy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { SUPER_ADMIN_ROLE_LABELS } from "@/lib/super-admin/labels";

interface Admin {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "SUPPORT";
  createdAt: string;
}

const EMPTY_FORM = { email: "", name: "", password: "", role: "SUPPORT" as Admin["role"] };

export function AdminsManager({
  admins,
  currentAdminId,
}: {
  admins: Admin[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const email = form.email.trim().toLowerCase();
    const name = form.name.trim();
    if (!email || !name) {
      toast.error("Email and name are required");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/super-admin/admins", {
        method: "POST",
        body: { email, name, password: form.password, role: form.role },
      });
      toast.success(`Admin ${email} dibuat`);
      setForm(EMPTY_FORM);
      setShowForm(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal membuat admin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRoleChange(a: Admin) {
    const next = a.role === "SUPER_ADMIN" ? "SUPPORT" : "SUPER_ADMIN";
    if (!(await confirm({
      title: "Ubah role admin?",
      description: `Ubah ${a.email} menjadi ${next}?`,
    }))) return;
    try {
      await apiFetch(`/api/super-admin/admins/${a.id}`, {
        method: "PATCH",
        body: { role: next },
      });
      toast.success(`${a.email} sekarang ${next}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal mengubah role.");
    }
  }

  async function handleDeactivate(a: Admin) {
    if (!(await confirm({
      title: "Deactivate admin?",
      description: `Deactivate ${a.email}? Mereka tidak bisa login lagi.`,
      destructive: true,
    }))) return;
    try {
      await apiFetch(`/api/super-admin/admins/${a.id}`, { method: "DELETE" });
      toast.success(`${a.email} dinonaktifkan`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menonaktifkan.");
    }
  }

  return (
    <div className="space-y-6">
      {!showForm ? (
        <Button
          onClick={() => setShowForm(true)}
          className="bg-brand-600 hover:bg-brand-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Tambah Admin
        </Button>
      ) : (
        <form
          onSubmit={handleCreate}
          className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Admin Baru</h2>
            <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Email" required>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@hivepos.id" required />
            </FormField>
            <FormField label="Name" required>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </FormField>
            <FormField label="Password (min 8)" required>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </FormField>
            <FormField label="Role">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as Admin["role"] })}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <option value="SUPPORT">SUPPORT (read-mostly)</option>
                <option value="SUPER_ADMIN">SUPER_ADMIN (full access)</option>
              </select>
            </FormField>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Buat
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}>Batal</Button>
          </div>
        </form>
      )}

      <div className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-[var(--color-border)] bg-muted/30">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold text-muted-foreground">Name</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Email</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Role</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground">Dibuat</th>
                <th className="px-4 py-3 font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {admins.map((a) => {
                const isSelf = a.id === currentAdminId;
                const Icon = a.role === "SUPER_ADMIN" ? Shield : LifeBuoy;
                return (
                  <tr key={a.id} className="hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">
                      {a.name}
                      {isSelf && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{a.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={a.role === "SUPER_ADMIN" ? "default" : "secondary"}>
                        <Icon className="mr-1 h-3 w-3" />
                        {SUPER_ADMIN_ROLE_LABELS[a.role] ?? a.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(a.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRoleChange(a)}
                          disabled={isSelf}
                          title={isSelf ? "Cannot change own role" : "Toggle role"}
                        >
                          <Shield className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeactivate(a)}
                          disabled={isSelf}
                          title={isSelf ? "Cannot deactivate yourself" : "Deactivate"}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
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
