"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Check, RotateCcw, Loader2 } from "lucide-react";
import { apiFetch } from "@/modules/shared";

export function ResolveButton({
  errorLogId,
  resolved,
}: {
  errorLogId: string;
  resolved: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function toggle() {
    setSubmitting(true);
    try {
      await apiFetch(`/api/super-admin/error-logs/${errorLogId}/resolve`, {
        method: resolved ? "DELETE" : "POST",
      });
      toast.success(resolved ? "Marked unresolved" : "Marked resolved");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Button
      variant={resolved ? "outline" : "default"}
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={toggle}
      disabled={submitting}
    >
      {submitting ? (
        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
      ) : resolved ? (
        <RotateCcw className="mr-1 h-3 w-3" />
      ) : (
        <Check className="mr-1 h-3 w-3" />
      )}
      {resolved ? "Reopen" : "Resolve"}
    </Button>
  );
}
