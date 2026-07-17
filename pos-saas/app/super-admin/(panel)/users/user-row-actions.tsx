"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Loader2, Power, Play, KeyRound, Copy, UserCog } from "lucide-react";

type DialogKind = "suspend" | "reactivate" | "reset" | "impersonate" | null;

export function UserRowActions({
  userId,
  userEmail,
  isActive,
  canImpersonate,
}: {
  userId: string;
  userEmail: string;
  isActive: boolean;
  // ponytail: gate passed in from the server page — SUPER_ADMIN viewer + active non-SUPER_ADMIN target.
  canImpersonate?: boolean;
}) {
  const router = useRouter();
  const { update } = useSession();
  const [open, setOpen] = useState<DialogKind>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  async function submit() {
    const trimmed = reason.trim();
    if (trimmed.length < 10) {
      toast.error("Alasan terlalu pendek — minimal 10 huruf.");
      return;
    }

    setSubmitting(true);
    try {
      if (open === "suspend") {
        const res = await fetch(`/api/super-admin/users/${userId}/suspend`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmed }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Suspend failed");
        toast.success("User suspended");
        closeDialog();
        router.refresh();
      } else if (open === "reactivate") {
        const res = await fetch(`/api/super-admin/users/${userId}/suspend`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmed || null }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => null))?.message ?? "Reactivate failed");
        toast.success("User reactivated");
        closeDialog();
        router.refresh();
      } else if (open === "reset") {
        const res = await fetch(`/api/super-admin/users/${userId}/reset-password`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: trimmed }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          if (res.status === 403) {
            throw new Error("Only SUPER_ADMIN can reset passwords");
          }
          throw new Error(body?.message ?? "Reset failed");
        }
        const data = await res.json();
        setTempPassword(data.data.tempPassword);
        toast.success("Password reset");
      } else if (open === "impersonate") {
        const res = await fetch(`/api/super-admin/impersonate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, reason: trimmed }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          if (res.status === 403) {
            throw new Error("Only SUPER_ADMIN can impersonate");
          }
          throw new Error(body?.error?.message ?? "Impersonation failed");
        }
        // Swap JWT to the target user. JWT callback verifies + applies the snapshot.
        await update({ impersonateUserId: userId });
        toast.success(`Viewing as ${userEmail}`);
        router.push("/dashboard");
        return; // router.push handles nav; don't close dialog
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request failed");
    } finally {
      setSubmitting(false);
    }
  }

  function closeDialog() {
    setOpen(null);
    setReason("");
    setTempPassword(null);
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {isActive ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={() => setOpen("suspend")}
          >
            <Power className="h-3 w-3" />
            Suspend
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={() => setOpen("reactivate")}
          >
            <Play className="h-3 w-3" />
            Reactivate
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs gap-1.5"
          onClick={() => setOpen("reset")}
        >
          <KeyRound className="h-3 w-3" />
          Reset PW
        </Button>
        {canImpersonate && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs gap-1.5"
            onClick={() => setOpen("impersonate")}
          >
            <UserCog className="h-3 w-3" />
            Impersonate
          </Button>
        )}
      </div>

      <Dialog open={open !== null} onOpenChange={(o) => (o ? null : closeDialog())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {open === "suspend" && "Suspend this user?"}
              {open === "reactivate" && "Reactivate this user?"}
              {open === "reset" && "Reset this user's password?"}
              {open === "impersonate" && `Impersonate ${userEmail}?`}
            </DialogTitle>
            <DialogDescription>
              {open === "suspend" &&
                `${userEmail} will be blocked from signing in. Active sessions are invalidated. A reason is required for the audit log.`}
              {open === "reactivate" &&
                `${userEmail} will regain access immediately. A reason is recorded in the audit log.`}
              {open === "reset" &&
                !tempPassword &&
                `A new temp password will be generated for ${userEmail}. Their current sessions will be invalidated. Show the temp password only to the user out-of-band.`}
              {open === "reset" &&
                tempPassword &&
                "Share this with the user out-of-band. They will be asked to change it after sign-in."}
              {open === "impersonate" &&
                "You'll be signed in as this tenant user with their exact permissions. Every action you take is audit-logged. Use only for support debugging."}
            </DialogDescription>
          </DialogHeader>

          {open === "reset" && tempPassword ? (
            <div className="space-y-2">
              <Label>Temporary password</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={tempPassword}
                  className="font-mono"
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(tempPassword);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="reason">
                Reason {(open === "suspend" || open === "reset" || open === "impersonate") && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Customer support ticket #1234, suspected compromise, …"
                rows={3}
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={closeDialog} disabled={submitting}>
              {tempPassword ? "Done" : "Cancel"}
            </Button>
            {!tempPassword && (
              <Button
                variant={open === "suspend" || open === "reset" ? "destructive" : "default"}
                onClick={submit}
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {open === "suspend" && "Suspend"}
                {open === "reactivate" && "Reactivate"}
                {open === "reset" && "Generate temp password"}
                {open === "impersonate" && "Sign in as user"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
