"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LucideIcon, AlertCircle } from "lucide-react";

// Shared error block — destructive sibling of EmptyState. Use for failed
// fetches / page-level errors with an optional retry. Solid card (not dashed)
// + role="alert" so screen readers announce it; EmptyState stays dashed for the
// "nothing here yet" case.

interface ErrorStateAction {
  label: string;
  onClick: () => void;
  variant?: "default" | "outline";
  icon?: LucideIcon;
  disabled?: boolean;
}

interface ErrorStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ErrorStateAction;
  /** Multiple actions (rendered in a row). Takes precedence over `action`. */
  actions?: ErrorStateAction[];
}

export function ErrorState({ icon: Icon = AlertCircle, title, description, action, actions }: ErrorStateProps) {
  const list = actions && actions.length > 0 ? actions : action ? [action] : [];
  return (
    <Card role="alert" className="animate-fade-in-up border-border/60 bg-card">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-destructive/10">
          <Icon className="h-6 w-6 text-destructive" />
        </div>
        <h3 className="mt-5 text-lg tracking-tight">{title}</h3>
        {description && (
          <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
        {list.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {list.map((a, i) => {
              const ActIcon = a.icon;
              return (
                <Button
                  key={i}
                  variant={a.variant ?? "default"}
                  onClick={a.onClick}
                  disabled={a.disabled}
                >
                  {ActIcon && <ActIcon className="h-4 w-4 mr-2" />}
                  {a.label}
                </Button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
