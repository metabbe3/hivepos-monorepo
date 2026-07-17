"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useConfirm } from "@/components/shared/confirm-dialog";

/**
 * Wraps the confirm-dialog-then-DELETE pattern repeated across every CRUD
 * page. Uses the shared `useConfirm` hook (AlertDialog UI with native
 * fallback when rendered outside the ConfirmProvider).
 *
 *   const { confirmAndDelete, deleting } = useDeleteConfirm({
 *     endpoint: "/api/users",
 *     successMessage: t("users.deleted"),
 *     errorMessage: t("users.failedDelete"),
 *     onDeleted: (id) => setUsers(prev => prev.filter(u => u.id !== id)),
 *   });
 *
 *   // In an onClick handler:
 *   if (await confirmAndDelete(u.id, t("users.deleteConfirm").replace("{name}", u.name))) {
 *     // deleted
 *   }
 *
 * `deleting` holds the in-flight id so callers can disable the row's button.
 */
export interface UseDeleteConfirmOptions {
  /** Base endpoint; DELETE will be sent to `{endpoint}/{id}`. */
  endpoint: string;
  successMessage: string;
  errorMessage: string;
  /** Invoked after a successful delete (typically optimistic list update). */
  onDeleted?: (id: string) => void;
}

export interface UseDeleteConfirmResult {
  /**
   * Show the confirm dialog. If the user accepts, DELETE the resource.
   * Returns true on successful deletion, false if cancelled or errored.
   */
  confirmAndDelete: (id: string, confirmMessage: string) => Promise<boolean>;
  /** The id currently being deleted, or null when idle. */
  deleting: string | null;
}

export function useDeleteConfirm({
  endpoint,
  successMessage,
  errorMessage,
  onDeleted,
}: UseDeleteConfirmOptions): UseDeleteConfirmResult {
  const confirm = useConfirm();
  const [deleting, setDeleting] = useState<string | null>(null);

  const confirmAndDelete = useCallback(
    async (id: string, confirmMessage: string): Promise<boolean> => {
      // ponytail: native window.confirm fallback runs when ConfirmProvider is absent
      // (e.g. in unit tests), keeping the spy-based contract intact.
      if (!(await confirm({ title: confirmMessage, destructive: true }))) return false;

      setDeleting(id);
      try {
        await apiFetch(`${endpoint}/${id}`, { method: "DELETE" });
        onDeleted?.(id);
        toast.success(successMessage);
        return true;
      } catch (err) {
        toast.error(err instanceof ApiClientError ? err.message : errorMessage);
        return false;
      } finally {
        setDeleting(null);
      }
    },
    [endpoint, successMessage, errorMessage, onDeleted, confirm],
  );

  return { confirmAndDelete, deleting };
}
