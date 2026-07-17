"use client";

import { useState } from "react";
import { Loader2, MessageCircle, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/modules/shared";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function WhatsAppToggle({
  tenantId,
  initialEnabled,
  onChanged,
}: {
  tenantId: string;
  initialEnabled: boolean;
  onChanged?: () => void;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    try {
      await apiFetch(`/api/super-admin/tenants/${tenantId}/whatsapp`, {
        method: "PATCH",
        body: { enabled: !enabled },
      });
      setEnabled(!enabled);
      toast.success(`WhatsApp ${!enabled ? "enabled" : "disabled"} for this tenant`);
      onChanged?.();
    } catch {
      toast.error("Failed to toggle WhatsApp");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-lg",
          enabled ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-muted",
        )}>
          <MessageCircle className={cn("h-4 w-4", enabled ? "text-emerald-600" : "text-muted-foreground")} />
        </div>
        <div>
          <p className="text-sm font-semibold">WhatsApp Automation</p>
          <p className="text-xs text-muted-foreground">
            {enabled ? "Tenant can connect WhatsApp + send auto messages" : "Tenant cannot use WhatsApp features"}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant={enabled ? "default" : "outline"} className={enabled ? "bg-emerald-600" : ""}>
          {enabled ? "Enabled" : "Disabled"}
        </Badge>
        <Button
          size="sm"
          variant={enabled ? "outline" : "default"}
          onClick={toggle}
          disabled={loading}
          className={cn("gap-1.5", !enabled && "bg-gradient-to-r from-emerald-600 to-emerald-700")}
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : enabled ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Check className="h-3.5 w-3.5" />
          )}
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>
    </div>
  );
}
