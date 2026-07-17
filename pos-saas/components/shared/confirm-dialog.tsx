"use client";

import { createContext, useContext, useRef, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/hooks/use-translation";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    // ponytail: graceful fallback to native confirm when provider missing,
    // so callers don't crash if rendered outside the dashboard shell.
    return (opts) => Promise.resolve(window.confirm(opts.description || opts.title));
  }
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm: ConfirmFn = (o) => {
    setOpts(o);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  };

  function close(result: boolean) {
    setOpen(false);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog
        open={open}
        onOpenChange={(v) => {
          if (!v) close(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
            {opts?.description && (
              <AlertDialogDescription>{opts.description}</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => close(false)}>
              {opts?.cancelLabel ?? t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={opts?.destructive ? "" : "bg-brand-600 hover:bg-brand-700"}
            >
              {opts?.confirmLabel ?? t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}
