"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Crown, Plus, ShieldCheck, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { WILDCARD } from "@/lib/permissions/definitions";
import type { Role } from "./types";
import { colorClass, isOwnerRole } from "./colors";
import { TOTAL_PERMISSIONS } from "./permission-groups";
import { PermissionEditor } from "./permission-editor";
import { ColorSwatchPicker } from "./color-swatch-picker";
import { PermissionSummaryBar } from "./permission-summary-bar";

interface RoleEditDialogProps {
  role: Role | null;
  creating: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function RoleEditDialog({
  role,
  creating,
  onClose,
  onSaved,
}: RoleEditDialogProps) {
  const isOwner = isOwnerRole(role);

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [color, setColor] = useState(role?.color ?? "purple");
  const [permissions, setPermissions] = useState<string[]>(
    role?.permissions ?? [],
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Nama peran wajib diisi.");
      return;
    }

    setSaving(true);
    try {
      const url = creating ? "/api/roles" : `/api/roles/${role!.id}`;
      const method = creating ? "POST" : "PATCH";
      const body: Record<string, unknown> = { name, description, color };
      if (!isOwner) body.permissions = permissions;

      await apiFetch(url, { method, body });

      toast.success(creating ? "Role created" : "Role updated");
      onSaved();
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Network error",
      );
    } finally {
      setSaving(false);
    }
  }

  const metadataDisabled = isOwner || role?.isSystem || false;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent
        className={cn(
          // mobile: full-screen sheet that scrolls as one document.
          // !important needed to override DialogContent's default centering
          // (top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 + max-w-[calc(100%-2rem)])
          "!fixed !inset-0 !grid !w-screen !max-w-none !translate-x-0 !translate-y-0 gap-0 overflow-y-auto rounded-none p-0",
          // desktop: centered, fixed-size two-pane modal with internal scroll
          "md:!inset-auto md:!top-1/2 md:!left-1/2 md:!max-h-[90vh] md:!max-w-5xl md:!w-auto",
          "md:!-translate-x-1/2 md:!-translate-y-1/2 md:overflow-hidden md:rounded-2xl",
          "shadow-2xl",
        )}
      >
        {/* Title bar — sticky on mobile so it stays visible while scrolling */}
        <div className="sticky top-0 z-20 flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-card px-5 py-3.5 md:static md:bg-transparent md:px-6 md:py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            {creating ? (
              <>
                <Plus className="h-5 w-5 text-primary" />
                Create Role
              </>
            ) : (
              <>
                <ShieldCheck className="h-5 w-5 text-primary" />
                Edit Role
              </>
            )}
            {!creating && role && (
              <Badge variant="outline" className="ml-1 gap-1.5">
                <span
                  className={cn("h-2 w-2 rounded-full", colorClass(role.color))}
                />
                {role.name}
              </Badge>
            )}
          </DialogTitle>
          {isOwner && (
            <Badge className="gap-1 bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-300">
              <Crown className="h-3 w-3" /> Owner · Wildcard
            </Badge>
          )}
        </div>

        {/* Two-pane body — mobile: flow in document; desktop: side-by-side grid */}
        <div className="flex flex-col md:grid md:min-h-0 md:flex-1 md:grid-cols-[320px_1fr]">
          {/* LEFT pane — metadata */}
          <aside className="shrink-0 space-y-4 border-b border-border/60 bg-muted/30 p-5 md:overflow-y-auto md:border-b-0 md:border-r">
            {/* Live preview */}
            <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm",
                    colorClass(color),
                  )}
                >
                  {isOwner ? (
                    <Lock className="h-4 w-4" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">
                    {name || "Role name"}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-muted-foreground">
                    {description || "Description will appear here"}
                  </p>
                </div>
              </div>
              <div className="mt-3 border-t border-border/40 pt-2.5">
                <PermissionSummaryBar
                  count={
                    permissions.includes(WILDCARD)
                      ? TOTAL_PERMISSIONS
                      : permissions.length
                  }
                  total={TOTAL_PERMISSIONS}
                  locked={isOwner}
                  size="sm"
                />
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Nama Role</Label>
              <Input
                id="role-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={metadataDisabled}
                placeholder="contoh: Supervisor"
              />
            </div>

            {/* Color */}
            <div className="space-y-1.5">
              <Label>Warna</Label>
              <ColorSwatchPicker
                value={color}
                onChange={setColor}
                disabled={metadataDisabled}
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="role-desc">Deskripsi</Label>
              <Input
                id="role-desc"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isOwner}
                placeholder="Role ini bisa apa saja…"
              />
            </div>

            {isOwner && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                Role Owner memiliki akses penuh dan tidak bisa dimodifikasi.
              </p>
            )}
          </aside>

          {/* RIGHT pane — permissions */}
          <div className="flex flex-col md:min-h-0 md:flex-1">
            <div className="flex shrink-0 items-center justify-between border-b border-border/60 px-5 py-3">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className="h-4 w-4 text-primary" /> Permissions
              </h3>
              <PermissionSummaryBar
                count={
                  permissions.includes(WILDCARD)
                    ? TOTAL_PERMISSIONS
                    : permissions.length
                }
                total={TOTAL_PERMISSIONS}
                locked={isOwner}
                size="md"
                showLabel
              />
            </div>

            <div className="p-5 md:min-h-0 md:flex-1 md:overflow-hidden">
              {isOwner ? (
                <div className="flex h-full flex-col items-center justify-center py-16 text-center">
                  <Crown className="h-10 w-10 text-amber-500" />
                  <p className="mt-3 text-sm font-medium">
                    Full Access (Wildcard)
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Owner memiliki semua izin secara otomatis dan tidak dapat
                    dibatasi.
                  </p>
                </div>
              ) : (
                <PermissionEditor
                  permissions={permissions}
                  onChange={setPermissions}
                  locked={isOwner}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer — sticky on mobile so action buttons are always reachable */}
        <div className="sticky bottom-0 z-20 flex shrink-0 items-center justify-between gap-2 border-t border-border/60 bg-card/95 px-5 py-3 backdrop-blur-sm md:static md:bg-muted/30 md:px-6">
          <p className="text-xs text-muted-foreground">
            {creating
              ? "Membuat role baru"
              : `Mengedit: ${role?.name ?? ""}`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Batal
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || isOwner}
              className="gap-1.5"
            >
              {saving
                ? "Menyimpan…"
                : creating
                  ? "Buat Role"
                  : "Simpan Perubahan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
