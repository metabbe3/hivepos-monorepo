"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, UserCog, UserPlus, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { CardListItem } from "@/components/shared/card-list";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGuardedPage } from "@/hooks/use-guarded-page";
import { useCrudResource } from "@/hooks/use-crud-resource";
import { useDeleteConfirm } from "@/hooks/use-delete-confirm";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { usePermissions } from "@/hooks/use-permissions";
import { apiFetch } from "@/modules/shared";
import { DynamicForm } from "@/lib/forms";
import { staffSchema } from "@/lib/forms/schemas";

interface Branch { id: string; name: string }

interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  roleId: string | null;
  branchId: string;
  createdAt: string;
  branch: { id: string; name: string };
  roleRef: { id: string; name: string; color: string } | null;
}

export default function UsersPage() {
  const { shouldRender } = useGuardedPage("users", "read");
  const { t } = useTranslation();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [pinUser, setPinUser] = useState<UserRow | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinSaving, setPinSaving] = useState(false);

  const attendanceOn = useFeatureFlag("staffAttendance");
  const can = usePermissions().can;
  const [quickOpen, setQuickOpen] = useState(false);
  const [qName, setQName] = useState("");
  const [qPhone, setQPhone] = useState("");
  const [qPin, setQPin] = useState("");
  const [qBranch, setQBranch] = useState("");
  const [quickSaving, setQuickSaving] = useState(false);

  const { items: users, loading, refresh } = useCrudResource<UserRow>({
    endpoint: "/api/users",
    enabled: shouldRender,
  });

  const { confirmAndDelete } = useDeleteConfirm({
    endpoint: "/api/users",
    successMessage: t("users.deleted"),
    errorMessage: t("common.networkError"),
    onDeleted: refresh,
  });

  useEffect(() => {
    if (!shouldRender) return;
    apiFetch<Branch[]>("/api/branches")
      .then((b) => setBranches(b.data))
      .catch(() => {});
  }, [shouldRender]);

  if (!shouldRender) return null;
  if (loading) return <PageLoading />;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(u: UserRow) {
    setEditing(u);
    setDialogOpen(true);
  }

  async function savePin() {
    if (!pinUser || !/^\d{4,6}$/.test(pinInput)) return;
    setPinSaving(true);
    try {
      await apiFetch(`/api/users/${pinUser.id}/pin`, { method: "PATCH", body: { pin: pinInput } });
      toast.success(t("attendance.pinSet"));
      setPinUser(null);
      setPinInput("");
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setPinSaving(false);
    }
  }

  async function saveQuick() {
    if (!qName.trim() || !/^\d{4,6}$/.test(qPin)) return;
    setQuickSaving(true);
    try {
      await apiFetch("/api/attendance/quick-staff", {
        method: "POST",
        body: { name: qName.trim(), phone: qPhone.trim() || undefined, pin: qPin, branchId: qBranch || undefined },
      });
      toast.success(t("attendance.pinSet"));
      setQuickOpen(false);
      setQName(""); setQPhone(""); setQPin(""); setQBranch("");
      refresh();
    } catch {
      toast.error(t("common.networkError"));
    } finally {
      setQuickSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("users.title")} description={t("users.description")} action={{ label: t("users.addUser"), onClick: openCreate }} />

      {attendanceOn && can("attendance", "edit") ? (
        <div className="flex justify-end -mt-2">
          <Button variant="outline" size="sm" onClick={() => setQuickOpen(true)}>
            <KeyRound className="h-4 w-4 mr-2" />
            {t("attendance.quickAdd")}
          </Button>
        </div>
      ) : null}

      {users.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title={t("users.noUsers")}
          description={t("users.noUsersDesc")}
          action={{ label: t("users.addUser"), onClick: openCreate }}
        />
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <CardListItem key={u.id} interactive>
              <CardContent className="py-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Avatar className={`h-9 w-9 shrink-0 ${u.role === "OWNER" ? "bg-[oklch(0.93_0.035_80)] dark:bg-[oklch(0.28_0.04_65)]" : "bg-muted/60"}`}>
                      <AvatarFallback className="bg-transparent text-sm font-bold">
                        {u.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold">{u.name}</p>
                        <Badge variant="secondary" className={`text-[10px]`}>
                          {u.roleRef?.name ?? u.role}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] border-border/60">
                          {u.branch?.name ?? t("branches.noBranch")}
                        </Badge>
                        {u.email.endsWith("@no-login.local") ? (
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700">
                            {t("attendance.attendanceOnly")}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(u)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    {attendanceOn && can("attendance", "edit") ? (
                      <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("attendance.setPin")} onClick={() => { setPinUser(u); setPinInput(""); }}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => confirmAndDelete(u.id, `${t("users.deleteConfirm")} ${u.name}?`)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </CardListItem>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {editing ? t("common.edit") : t("users.addUser")}
            </DialogTitle>
          </DialogHeader>
          <DynamicForm 
            schema={staffSchema} 
            initialData={editing ? {
              name: editing.name,
              email: editing.email,
              phone: editing.phone,
              roleId: editing.roleId ?? "",
            } : undefined}
            recordId={editing?.id} 
            onSuccess={() => {
              setDialogOpen(false);
              refresh();
            }} 
            onCancel={() => setDialogOpen(false)} 
          />
        </DialogContent>
      </Dialog>

      {/* Set clock PIN (attendance feature) */}
      <Dialog open={!!pinUser} onOpenChange={(o) => { if (!o) { setPinUser(null); setPinInput(""); } }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {t("attendance.setPin")} — {pinUser?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>{t("attendance.enterPin")}</Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <Button onClick={savePin} disabled={!/^\d{4,6}$/.test(pinInput) || pinSaving} className="w-full">
              {t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick add — attendance only (no email/login) */}
      <Dialog open={quickOpen} onOpenChange={(o) => { setQuickOpen(o); if (!o) { setQName(""); setQPhone(""); setQPin(""); setQBranch(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {t("attendance.quickAdd")}
            </DialogTitle>
          </DialogHeader>
          <p className="-mt-1 text-xs text-muted-foreground">{t("attendance.quickAddDesc")}</p>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nama</Label>
              <Input value={qName} onChange={(e) => setQName(e.target.value)} placeholder="Nama staff" />
            </div>
            <div className="space-y-1.5">
              <Label>Telepon</Label>
              <Input value={qPhone} onChange={(e) => setQPhone(e.target.value)} placeholder="08xx (opsional)" />
            </div>
            <div className="space-y-1.5">
              <Label>Outlet</Label>
              <select
                value={qBranch}
                onChange={(e) => setQBranch(e.target.value)}
                className="w-full rounded-lg border border-border/60 bg-background px-3 py-2 text-sm"
              >
                <option value="">—</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("attendance.enterPin")}</Label>
              <Input
                inputMode="numeric"
                maxLength={4}
                value={qPin}
                onChange={(e) => setQPin(e.target.value.replace(/\D/g, ""))}
                placeholder="••••"
              />
            </div>
            <Button onClick={saveQuick} disabled={!qName.trim() || !/^\d{4,6}$/.test(qPin) || quickSaving} className="w-full">
              {t("common.confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
