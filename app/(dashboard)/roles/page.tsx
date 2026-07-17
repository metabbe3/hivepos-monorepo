"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Shield, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGuardedPage } from "@/hooks/use-guarded-page";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { RoleList } from "@/components/roles/role-list";
import { RoleEditDialog } from "@/components/roles/role-edit-dialog";
import type { Role } from "@/components/roles/types";

export default function RolesPage() {
  const { shouldRender } = useGuardedPage("roles", "read");
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Role | null>(null);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Role | null>(null);

  useEffect(() => {
    if (!shouldRender) return;
    apiFetch<Role[]>("/api/roles")
      .then((r) => setRoles(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [shouldRender]);

  function refresh() {
    apiFetch<Role[]>("/api/roles")
      .then((r) => setRoles(r.data))
      .catch(() => {});
  }

  if (!shouldRender) return null;
  if (loading) return <PageLoading />;

  function openEdit(role: Role) {
    setEditing(role);
    setCreating(false);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setCreating(true);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    try {
      await apiFetch(`/api/roles/${deleteConfirm.id}`, { method: "DELETE" });
      toast.success(`Role "${deleteConfirm.name}" deleted`);
      setDeleteConfirm(null);
      refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Network error");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & Permissions"
        description="Kelola hak akses untuk setiap role di bisnis Anda"
        action={{ label: "Create Role", onClick: openCreate }}
      />

      {roles.length === 0 ? (
        <EmptyState
          icon={Shield}
          title="Belum ada role"
          description="Buat role kustom untuk mengatur akses staff Anda"
          action={{ label: "Create Role", onClick: openCreate }}
        />
      ) : (
        <RoleList roles={roles} onEdit={openEdit} onDelete={setDeleteConfirm} />
      )}

      {/* ─── Edit / Create Dialog ─── */}
      {dialogOpen && (
        <RoleEditDialog
          role={editing}
          creating={creating}
          onClose={() => {
            setDialogOpen(false);
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setDialogOpen(false);
            setEditing(null);
            setCreating(false);
            refresh();
          }}
        />
      )}

      {/* ─── Delete Confirmation ─── */}
      <Dialog
        open={!!deleteConfirm}
        onOpenChange={(v) => !v && setDeleteConfirm(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete Role
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete the role{" "}
            <strong>{deleteConfirm?.name}</strong>? Users assigned to this role
            will need to be reassigned.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
