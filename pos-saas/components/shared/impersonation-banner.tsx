"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";

// ponytail: single-purpose banner. Shows only when session.user.impersonating is true.
// Talks to /api/super-admin/impersonate/stop for audit, then calls session.update
// to restore the super-admin JWT, then redirects to the panel.
export function ImpersonationBanner() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [stopping, setStopping] = useState(false);

  const impersonating = (session?.user as any)?.impersonating === true;
  const targetEmail = (session?.user as any)?.impersonatedEmail ?? "tenant user";

  if (status !== "authenticated" || !impersonating) return null;

  async function stop() {
    setStopping(true);
    try {
      const res = await fetch("/api/super-admin/impersonate/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error((await res.json().catch(() => null))?.error?.message ?? "Stop failed");
      }
      // Restore the super-admin JWT snapshot.
      await update({ stopImpersonation: true });
      toast.success("Stopped impersonation");
      router.push("/super-admin/users");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to stop impersonation");
      // Last resort: hard sign-out so we never strand a super-admin in a tenant session.
      await signOut({ callbackUrl: "/super-admin/login" });
    } finally {
      setStopping(false);
    }
  }

  return (
    <div className="sticky top-0 z-50 flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <span>
          Impersonating <strong className="font-semibold">{targetEmail}</strong> — actions are audit-logged.
        </span>
      </div>
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {stopping ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        Stop
      </button>
    </div>
  );
}
