"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2, ShieldAlert, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";

interface ConfirmDeleteDialogProps {
  /** The customer to delete. Null when dialog is closed. */
  customer: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful deletion with the deleted customer's id. */
  onSuccess: (deletedId: string) => void;
  /** Optional: called when user clicks "Edit Instead" in the blocked state. */
  onEditInstead?: (id: string) => void;
}

type State = "idle" | "loading" | "blocked";

/**
 * Destructive confirmation dialog for customer deletion.
 *
 * Handles three states:
 *   - idle: default confirmation UI
 *   - loading: spinner during the DELETE request
 *   - blocked: server returned BUSINESS_RULE_VIOLATION (customer has orders),
 *     so we show a helpful message + an "Edit Instead" CTA instead of a retry.
 */
export function ConfirmDeleteDialog({
  customer,
  open,
  onOpenChange,
  onSuccess,
  onEditInstead,
}: ConfirmDeleteDialogProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>("idle");

  // Reset to idle whenever the target customer changes or dialog reopens.
  useEffect(() => {
    if (open) setState("idle");
  }, [open, customer?.id]);

  if (!customer) return null;

  async function handleDelete() {
    if (!customer) return;
    setState("loading");
    try {
      await apiFetch(`/api/customers/${customer.id}`, { method: "DELETE" });
      toast.success(t("customers.deleted").replace("{name}", customer.name));
      onOpenChange(false);
      onSuccess(customer.id);
    } catch (err) {
      if (
        err instanceof ApiClientError &&
        err.code === "BUSINESS_RULE_VIOLATION"
      ) {
        setState("blocked");
      } else {
        toast.error(
          err instanceof ApiClientError
            ? err.message
            : t("customers.failedDelete"),
        );
        setState("idle");
      }
    }
  }

  function handleEditInstead() {
    if (!customer) return;
    onOpenChange(false);
    onEditInstead?.(customer.id);
  }

  const blocked = state === "blocked";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              blocked
                ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300"
                : "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300",
            )}
          >
            {blocked ? (
              <ShieldAlert className="h-5 w-5" />
            ) : (
              <Trash2 className="h-5 w-5" />
            )}
          </div>
          <span className="text-base font-semibold">
            {blocked
              ? t("customers.deleteBlockedTitle")
              : t("customers.deleteCustomer")}
          </span>
        </DialogTitle>

        {blocked ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("customers.deleteBlocked").replace("{name}", customer.name)}
            </p>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
              <p className="text-xs text-muted-foreground">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-amber-500" />
                {t("customers.deleteWarning")}
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {t("customers.deleteConfirm").replace("{name}", customer.name)}
            </p>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
                {t("customers.deleteWarning")}
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {blocked ? (
            onEditInstead && (
              <Button onClick={handleEditInstead} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" />
                {t("customers.editInstead")}
              </Button>
            )
          ) : (
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={state === "loading"}
              className="gap-1.5"
            >
              {state === "loading" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {t("customers.deleting")}
                </>
              ) : (
                <>
                  <Trash2 className="h-3.5 w-3.5" />
                  {t("customers.deleteCustomer")}
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
