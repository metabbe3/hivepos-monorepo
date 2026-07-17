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
import { Loader2, Power, Play } from "lucide-react";

export function TenantDetailClient({
  tenantId,
  isActive,
}: {
  tenantId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const willSuspend = isActive;

  async function submit() {
    const trimmed = reason.trim();
    if (willSuspend && trimmed.length < 10) {
      toast.error("Alasan terlalu pendek — minimal 10 huruf.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/tenants/${tenantId}/suspend`, {
        method: willSuspend ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: trimmed || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Request failed");
      }
      toast.success(willSuspend ? "Tenant suspended" : "Tenant reactivated");
      setOpen(false);
      setReason("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={willSuspend ? "destructive" : "default"}
            size="sm"
            className="gap-2"
          />
        }
      >
        {willSuspend ? <Power className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {willSuspend ? "Suspend" : "Reactivate"}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {willSuspend ? "Suspend this tenant?" : "Reactivate this tenant?"}
          </DialogTitle>
          <DialogDescription>
            {willSuspend
              ? "All users of this tenant will be blocked from signing in. A reason is required for the audit log."
              : "The tenant will regain access immediately. An optional reason is recorded in the audit log."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reason">
            Reason {willSuspend && <span className="text-destructive">*</span>}
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              willSuspend ? "e.g. Chargeback dispute, fraud suspected, …" : "Optional"
            }
            rows={3}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant={willSuspend ? "destructive" : "default"}
            onClick={submit}
            disabled={submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {willSuspend ? "Suspend" : "Reactivate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
