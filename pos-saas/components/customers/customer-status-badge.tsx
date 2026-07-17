"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CUSTOMER_STATUS_CONFIG, type CustomerStatus } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";

interface CustomerStatusBadgeProps {
  status: CustomerStatus;
  className?: string;
}

export function CustomerStatusBadge({
  status,
  className,
}: CustomerStatusBadgeProps) {
  const { t } = useTranslation();
  const cfg = CUSTOMER_STATUS_CONFIG[status];
  return (
    <Badge
      className={cn(
        "shrink-0 text-[10px] uppercase tracking-wide",
        cfg.color,
        className,
      )}
    >
      {t(cfg.labelKey)}
    </Badge>
  );
}
