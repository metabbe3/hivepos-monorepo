"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Wallet, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";

type PaymentMethod = "CASH" | "QRIS" | "TRANSFER";

interface TopUpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  onSuccess: () => void;
}

const QUICK_AMOUNTS = [50000, 100000, 200000, 500000];

export function TopUpDialog({
  open,
  onOpenChange,
  customerId,
  onSuccess,
}: TopUpDialogProps) {
  const { t } = useTranslation();
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  function reset() {
    setAmount("");
    setPaymentMethod("CASH");
    setDescription("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!customerId) return;
    setSaving(true);
    try {
      await apiFetch(`/api/customers/${customerId}/deposit`, {
        method: "POST",
        body: {
          amount: parseFloat(amount),
          paymentMethod,
          description: description || undefined,
        },
      });
      toast.success(t("deposit.topUpSuccess"));
      onOpenChange(false);
      reset();
      onSuccess();
    } catch (err) {
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : t("deposit.failedTopUp"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            {t("deposit.topUpTitle")}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-1.5 rounded-lg border border-border/30 bg-muted/30 p-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("common.amount")} (Rp)
            </Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
              required
            />
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  className="rounded-full bg-muted/60 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {amt >= 1000 ? `${amt / 1000}K` : amt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border/30 bg-muted/30 p-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("deposit.paymentMethod")}
            </Label>
            <Select
              value={paymentMethod}
              onValueChange={(v) => v && setPaymentMethod(v as PaymentMethod)}
              items={[
                { value: "CASH", label: t("paymentMethod.cash") },
                { value: "QRIS", label: t("paymentMethod.qris") },
                { value: "TRANSFER", label: t("paymentMethod.transfer") },
              ]}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">{t("paymentMethod.cash")}</SelectItem>
                <SelectItem value="QRIS">{t("paymentMethod.qris")}</SelectItem>
                <SelectItem value="TRANSFER">{t("paymentMethod.transfer")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 rounded-lg border border-border/30 bg-muted/30 p-3">
            <Label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("common.notes")}
            </Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("common.optionalNotes")}
            />
          </div>

          <DialogFooter>
            <Button
              type="submit"
              disabled={saving}
              className="w-full gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 shadow-md shadow-emerald-500/15 transition-all hover:shadow-lg hover:brightness-105 sm:w-auto"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wallet className="h-4 w-4" />
              )}
              {t("deposit.topUpButton")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
