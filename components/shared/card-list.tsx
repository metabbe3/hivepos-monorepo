"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Core className shared by every "list item" Card across the dashboard
 * (users, orders, expenses, services, inventory, branches, ...).
 *
 * Verbatim copy of the inline className historically duplicated on every
 * `<Card>` element used as a list row.
 */
export const CARD_LIST_ITEM_CLASS =
  "border border-border/40 bg-card shadow-sm rounded-xl";

/**
 * Interactive list-item Card with hover lift + pointer affordance.
 * Use this when the entire card is a clickable row (link/wrapped button).
 */
export const CARD_LIST_ITEM_INTERACTIVE_CLASS = cn(
  CARD_LIST_ITEM_CLASS,
  "hover:shadow-md transition-all card-clean",
);

export interface CardListItemProps {
  /** Optional inner className; placed after the shared CARD_LIST_ITEM_CLASS. */
  className?: string;
  /** Optional content rendered inside <CardContent>. Pass null to render raw Card. */
  children?: ReactNode;
  /** When true, applies the interactive hover-lift variant. */
  interactive?: boolean;
  /** Spread onto the underlying <Card> element (onClick, etc.). */
  [key: string]: unknown;
}

export function CardListItem({
  className,
  children,
  interactive = false,
  ...rest
}: CardListItemProps) {
  return (
    <Card
      className={cn(
        interactive ? CARD_LIST_ITEM_INTERACTIVE_CLASS : CARD_LIST_ITEM_CLASS,
        className,
      )}
      {...rest}
    >
      {children}
    </Card>
  );
}
