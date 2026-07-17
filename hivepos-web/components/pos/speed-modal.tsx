"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import type { BaseItem, SpeedType } from "@/lib/service-transformer";
import { Clock, Zap, Timer } from "lucide-react";

const SPEED_ICONS: Record<SpeedType, React.ReactNode> = {
  reguler: <Clock className="h-4 w-4" />,
  express24: <Zap className="h-4 w-4" />,
  express7: <Timer className="h-4 w-4" />,
  standalone: null,
};

const SPEED_COLORS: Record<SpeedType, string> = {
  reguler: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50",
  express24: "border-amber-200 hover:border-amber-400 hover:bg-amber-50/50",
  express7: "border-red-200 hover:border-red-400 hover:bg-red-50/50",
  standalone: "",
};

interface SpeedModalProps {
  baseItem: BaseItem | null;
  open: boolean;
  onClose: () => void;
  onSelect: (serviceId: string) => void;
}

export function SpeedModal({ baseItem, open, onClose, onSelect }: SpeedModalProps) {
  const { t } = useTranslation();

  if (!baseItem) return null;

  const speedLabel = (speed: SpeedType): string => {
    switch (speed) {
      case "reguler": return t("pos.speedReguler");
      case "express24": return t("pos.speedExpress24");
      case "express7": return t("pos.speedExpress7");
      default: return "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md rounded-xl">
        <DialogHeader>
          <DialogTitle className="text-base">{baseItem.baseName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {baseItem.variants.map((variant) => (
            <button
              key={variant.serviceId}
              type="button"
              className={`flex w-full items-center justify-between rounded-xl border-2 px-4 py-3 transition-all ${SPEED_COLORS[variant.speed]} ${
                variant.speed === "reguler" ? "ring-1 ring-emerald-200" : ""
              }`}
              onClick={() => {
                onSelect(variant.serviceId);
                onClose();
              }}
            >
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{SPEED_ICONS[variant.speed]}</span>
                <span className="font-medium text-sm">{speedLabel(variant.speed)}</span>
                {variant.speed === "reguler" && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-100/80 text-emerald-700">
                    Default
                  </Badge>
                )}
              </div>
              <span className="font-bold">{formatCurrency(variant.basePrice)}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
