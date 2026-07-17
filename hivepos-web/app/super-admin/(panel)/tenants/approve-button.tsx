"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

// ponytail: minimal client wrapper — server component passes just the id.
// One button, one fetch, one router.refresh(). No modal — approving is a
// low-stakes action; if misclicked, the tenant is just active (which is fine
// since they were going to be approved anyway).
export function ApproveButton({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function approve() {
    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/super-admin/tenants/${tenantId}/approve`,
        { method: "POST" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Approve failed");
      }
      toast.success("Tenant approved — trial 90 hari dimulai");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button size="sm" variant="default" onClick={approve} disabled={submitting} className="gap-1.5">
      {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
      Approve
    </Button>
  );
}
