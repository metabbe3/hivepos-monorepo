"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ReactNode } from "react";

/**
 * Standard CRUD create/edit dialog chrome used across dashboard pages.
 *
 * Renders <Dialog><DialogContent><DialogHeader><DialogTitle>…</DialogTitle>
 * </DialogHeader>{children}{footer?}</DialogContent></Dialog> with the
 * consistent flex-gap title layout used in branches/users/services/etc.
 *
 * Caller is responsible for the <form onSubmit> wrapper — render it as part
 * of `children` so submit semantics remain local to the page that owns state.
 */
export interface CrudDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Already-localized title text. The caller decides create-vs-edit wording. */
  title: ReactNode;
  /** Optional icon rendered before the title. */
  icon?: ReactNode;
  /** Dialog body (typically a <form> with field elements + DialogFooter). */
  children?: ReactNode;
  /** Optional footer slot rendered after children. */
  footer?: ReactNode;
  /** Extra className applied to DialogContent. */
  className?: string;
}

export function CrudDialog({
  open,
  onOpenChange,
  title,
  icon,
  children,
  footer,
  className,
}: CrudDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {icon}
            {title}
          </DialogTitle>
        </DialogHeader>
        {children}
        {footer}
      </DialogContent>
    </Dialog>
  );
}
