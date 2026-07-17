"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Loader2, Lock, LogOut, ShieldAlert, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/modules/shared";

export function SettingsManager({ admin }: { admin: { id: string; email: string; name: string; role: string } }) {
  const confirm = useConfirm();
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [forcing, setForcing] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw.length < 8) {
      toast.error("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPw !== confirmPw) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setSavingPw(true);
    try {
      await apiFetch("/api/super-admin/me/password", {
        method: "POST",
        body: { currentPassword: currentPw, newPassword: newPw },
      });
      toast.success("Password diubah. Session lain sudah di-revoke — silakan login ulang dengan password baru.");
      // ponytail: password change bumps sessionVersion; current session must re-auth.
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
      setTimeout(() => signOut({ callbackUrl: "/super-admin/login" }), 1500);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal mengubah password.");
    } finally {
      setSavingPw(false);
    }
  }

  async function handleRevokeSessions() {
    if (!(await confirm({
      title: "Revoke semua session?",
      description: "Revoke semua session lain? Device lain akan dipaksa login ulang.",
      destructive: true,
    }))) return;
    setRevoking(true);
    try {
      await apiFetch("/api/super-admin/me/sessions", { method: "POST" });
      toast.success("Session lain di-revoke. Device ini tetap aktif.");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal revoke sessions.");
    } finally {
      setRevoking(false);
    }
  }

  async function handleForceUpdatePwa() {
    if (!(await confirm({
      title: "Force-update semua PWA?",
      description:
        "Semua device yang memakai PWA (kasir, owner) akan di-nuke: cache dihapus, service worker di-unregister, dan halaman di-reload. Pakai untuk hotfix atau perubahan breaking di service worker.",
      confirmLabel: "Force Update",
      destructive: true,
    }))) return;
    setForcing(true);
    try {
      await apiFetch("/api/super-admin/pwa/force-update", { method: "POST" });
      toast.success("Nonce PWA dirotasi. Device lain akan reload pada poll berikutnya (max 10 menit).");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal memicu force-update.");
    } finally {
      setForcing(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <section className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm p-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
          <Lock className="h-4 w-4" />
          Account
        </h2>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-mono">{admin.email}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Name</dt>
            <dd>{admin.name}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="font-semibold">{admin.role}</dd>
          </div>
        </dl>
      </section>

      <form onSubmit={handleChangePassword} className="rounded-xl bg-card ring-1 ring-foreground/10 shadow-sm p-6 space-y-4">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Lock className="h-4 w-4" />
          Change Password
        </h2>
        <div className="space-y-3">
          <FormField label="Current password">
            <Input type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} required />
          </FormField>
          <FormField label="New password (min 8)">
            <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} required />
          </FormField>
          <FormField label="Confirm new password">
            <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} required />
          </FormField>
        </div>
        <Button type="submit" disabled={savingPw} className="bg-brand-600 hover:bg-brand-700">
          {savingPw && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Ubah Password
        </Button>
        <p className="text-xs text-muted-foreground">
          Mengubah password otomatis revoke semua session di device lain.
        </p>
      </form>

      <section className="rounded-xl bg-destructive/5 ring-1 ring-destructive/20 p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-destructive">
          <ShieldAlert className="h-4 w-4" />
          Active Sessions
        </h2>
        <p className="text-sm text-muted-foreground">
          Revoke semua session lain tanpa mengubah password. Device ini tetap aktif.
        </p>
        <Button variant="destructive" onClick={handleRevokeSessions} disabled={revoking}>
          {revoking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
          Revoke Other Sessions
        </Button>
      </section>

      <section className="rounded-xl bg-amber-50/60 dark:bg-amber-900/10 ring-1 ring-amber-300/50 dark:ring-amber-700/40 p-6 space-y-3">
        <h2 className="flex items-center gap-2 text-lg font-bold text-amber-800 dark:text-amber-300">
          <RefreshCw className="h-4 w-4" />
          PWA Force Update
        </h2>
        <p className="text-sm text-amber-800/80 dark:text-amber-300/70">
          Rotasi nonce PWA untuk semua device terinstall. Setiap kasir / owner yang memakai
          PWA akan detect perubahan pada poll berikutnya (max 10 menit), hapus cache lokal,
          unregister service worker, dan reload halaman. Pakai untuk hotfix atau breaking
          change di service worker.
        </p>
        <Button
          variant="outline"
          onClick={handleForceUpdatePwa}
          disabled={forcing}
          className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/30"
        >
          {forcing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Force Update All PWAs
        </Button>
      </section>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
