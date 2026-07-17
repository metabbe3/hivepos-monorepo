"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Plus, UserPlus, DollarSign, ShoppingCart } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export function QuickActionsBar() {
  const router = useRouter();
  const { t } = useTranslation();

  const actions = [
    {
      label: t("orders.newOrder"),
      icon: ShoppingCart,
      onClick: () => router.push("/laundry/orders/new"),
      primary: true,
    },
    {
      label: t("customers.addCustomer"),
      icon: UserPlus,
      onClick: () => router.push("/customers"),
      primary: false,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Button
            key={action.label}
            variant={action.primary ? "default" : "outline"}
            size="sm"
            className="h-8 gap-2 rounded-lg text-sm"
            onClick={action.onClick}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{action.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
