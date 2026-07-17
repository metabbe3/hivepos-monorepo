import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface PageHeaderAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline" | "secondary" | "ghost" | "destructive" | "link";
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: PageHeaderAction;
  actions?: PageHeaderAction[];
}

export function PageHeader({ title, description, action, actions }: PageHeaderProps) {
  const allActions = actions ?? (action ? [action] : []);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {allActions.length > 0 && (
        <div className="flex gap-2 shrink-0">
          {allActions.map((act, i) => (
            <Button
              key={i}
              variant={act.variant ?? "default"}
              onClick={act.onClick}
              className={act.variant ? "" : "bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105"}
            >
              {i === allActions.length - 1 && <Plus className="mr-2 h-4 w-4" />}
              {act.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
