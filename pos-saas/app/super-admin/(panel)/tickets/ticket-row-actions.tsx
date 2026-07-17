"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Settings2 } from "lucide-react";
import {
  TICKET_STATUSES,
  TICKET_PRIORITIES,
  type TicketStatus,
  type TicketPriority,
} from "@/lib/tickets-constants";
import {
  TICKET_STATUS_LABELS,
  TICKET_PRIORITY_LABELS,
} from "@/lib/super-admin/labels";

export function TicketRowActions({
  ticketId,
  currentStatus,
  currentPriority,
}: {
  ticketId: string;
  currentStatus: TicketStatus;
  currentPriority: TicketPriority;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [field, setField] = useState<"status" | "priority">("status");
  const [statusValue, setStatusValue] = useState<TicketStatus>(currentStatus);
  const [priorityValue, setPriorityValue] = useState<TicketPriority>(currentPriority);
  const [submitting, setSubmitting] = useState(false);

  function openFor(f: "status" | "priority") {
    setField(f);
    setStatusValue(currentStatus);
    setPriorityValue(currentPriority);
    setOpen(true);
  }

  async function submit() {
    const value = field === "status" ? statusValue : priorityValue;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/super-admin/tickets/${ticketId}/${field}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Update failed (${res.status})`);
      }
      toast.success(`${field} updated`);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => openFor("status")}
      >
        Status
      </Button>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-2 text-xs"
        onClick={() => openFor("priority")}
      >
        Priority
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              Set {field}
            </DialogTitle>
            <DialogDescription>
              Update this ticket&apos;s {field}. The change is recorded in the audit log.
            </DialogDescription>
          </DialogHeader>

          {field === "status" ? (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusValue}
                onValueChange={(v) => setStatusValue(v as TicketStatus)}
                items={TICKET_STATUSES.map((s) => ({ value: s, label: TICKET_STATUS_LABELS[s] ?? s }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {TICKET_STATUS_LABELS[s] ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={priorityValue}
                onValueChange={(v) => setPriorityValue(v as TicketPriority)}
                items={TICKET_PRIORITIES.map((p) => ({ value: p, label: TICKET_PRIORITY_LABELS[p] ?? p }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {TICKET_PRIORITY_LABELS[p] ?? p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
