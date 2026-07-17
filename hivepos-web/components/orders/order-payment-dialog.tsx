"use client";

import { useRef } from "react";
import { flushSync } from "react-dom";
import { Wallet, QrCode } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import type { OrderDetail, PayFormState } from "./order-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: OrderDetail;
  form: PayFormState;
  onFormChange: (next: PayFormState) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function OrderPaymentDialog({
  open,
  onOpenChange,
  order,
  form,
  onFormChange,
  onSubmit,
}: Props) {
  const { t } = useTranslation();
  const orderFlowV2 = useFeatureFlag("orderFlowV2");
  const formRef = useRef<HTMLFormElement>(null);
  const remaining = order.totalAmount - order.paidAmount;

  // orderFlowV2: one-tap "paid exact, via QRIS, now" for the common pickup-payment case.
  const quickPay = () => {
    // flushSync forces the parent's form state to commit before we submit, so
    // handlePayment reads the quick-pay values deterministically (no race with
    // React batching on a payment path).
    flushSync(() => {
      onFormChange({
        ...form,
        amount: String(remaining),
        paymentMethod: "QRIS",
        notes: "",
        paidAt: new Date().toISOString().slice(0, 10),
      });
    });
    formRef.current?.requestSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("orderDetails.recordPayment")}</DialogTitle>
        </DialogHeader>
        {orderFlowV2 && remaining > 0 && (
          <Tooltip>
            <TooltipTrigger
              render={
                <button
                  type="button"
                  onClick={quickPay}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
                />
              }
            >
              <QrCode className="h-4 w-4" />
              {t("orderDetails.paidQrisNow")}
            </TooltipTrigger>
            <TooltipContent>{t("orderDetails.quickPayHint")}</TooltipContent>
          </Tooltip>
        )}
        <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("orderDetails.amount")}</Label>
            <Input
              type="number"
              value={form.amount}
              onChange={(e) => onFormChange({ ...form, amount: e.target.value })}
              placeholder={String(remaining)}
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("orderDetails.remaining")}: {formatCurrency(remaining)}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t("orderDetails.paymentMethod")}</Label>
            <Select
              value={form.paymentMethod}
              onValueChange={(v) =>
                v &&
                onFormChange({
                  ...form,
                  paymentMethod: v as PayFormState["paymentMethod"],
                })
              }
              items={[
                { value: "CASH", label: t("paymentMethod.cash") },
                { value: "DEPOSIT", label: t("paymentMethod.deposit") },
                { value: "QRIS", label: t("paymentMethod.qris") },
                { value: "TRANSFER", label: t("paymentMethod.transfer") },
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">{t("paymentMethod.cash")}</SelectItem>
                <SelectItem value="DEPOSIT">
                  {t("paymentMethod.deposit")}
                </SelectItem>
                <SelectItem value="QRIS">{t("paymentMethod.qris")}</SelectItem>
                <SelectItem value="TRANSFER">
                  {t("paymentMethod.transfer")}
                </SelectItem>
              </SelectContent>
            </Select>
            {form.paymentMethod === "DEPOSIT" && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Wallet className="h-3.5 w-3.5" />
                    {t("deposit.walletBalance")}
                  </span>
                  <span className="font-semibold">
                    {formatCurrency(order.customerBalance)}
                  </span>
                </div>
                {form.amount &&
                  !isNaN(parseFloat(form.amount)) &&
                  parseFloat(form.amount) > 0 &&
                  (() => {
                    const afterBalance =
                      order.customerBalance - parseFloat(form.amount);
                    const insufficient = afterBalance < 0;
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">
                            {t("deposit.balanceAfter")}
                          </span>
                          <span
                            className={
                              insufficient
                                ? "font-semibold text-red-600 dark:text-red-400"
                                : "font-semibold text-emerald-600 dark:text-emerald-400"
                            }
                          >
                            {formatCurrency(afterBalance)}
                          </span>
                        </div>
                        {insufficient && (
                          <p className="text-xs font-medium text-red-600 dark:text-red-400">
                            {t("deposit.insufficientBalance")}
                          </p>
                        )}
                      </>
                    );
                  })()}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label>{t("common.notes")}</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => onFormChange({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("orderDetails.paymentDate")}</Label>
            <Input
              type="date"
              value={form.paidAt}
              onChange={(e) => onFormChange({ ...form, paidAt: e.target.value })}
            />
          </div>
          <DialogFooter>
            <Button
              type="submit"
              className="bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105"
            >
              {t("orderDetails.recordPayment")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
