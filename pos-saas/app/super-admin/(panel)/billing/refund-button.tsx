"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw } from "lucide-react";

export function RefundButton({
  paymentId,
  tenantName,
  amount,
}: {
  paymentId: string;
  tenantName: string;
  amount: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      toast.error("Alasan terlalu pendek — minimal 10 huruf.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/billing/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Refund failed");
      }
      toast.success("Payment refunded");
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 h-7 px-2 text-xs" />
        }
      >
        <RotateCcw className="h-3 w-3" />
        Refund
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Refund this payment?</DialogTitle>
          <DialogDescription>
            {tenantName} — {amount}. The payment will be marked REFUNDED. Branch coverage is
            NOT revoked. A reason is required for the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">
            Reason <span className="text-destructive">*</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer dispute resolved, duplicate charge, …"
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirm refund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
