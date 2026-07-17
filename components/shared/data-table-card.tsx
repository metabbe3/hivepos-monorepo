"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ReactNode } from "react";

/**
 * Column descriptor for DataTableCard.
 *
 * `header` is pre-localized text (the caller runs it through `t()`).
 * `render(row)` returns the cell content. `align` controls the text-align
 * of both the <th> and <td> (defaults to "left"). `className` is applied
 * ONLY to the <td> — use it for cell-specific styling (tabular-nums,
 * text-muted-foreground, font-medium, truncate, etc.).
 */
export interface Column<T> {
  header: ReactNode;
  render: (row: T, rowIndex: number) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
}

/**
 * Card-wrapped data table with empty-state handling.
 *
 * Renders the standard structure used by the customer-detail tabs and other
 * CRUD tables:
 *
 *   <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
 *     <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
 *     <CardContent>
 *       {empty ? <p py-8 text-center text-muted-foreground> : <table>…}
 *     </CardContent>
 *   </Card>
 *
 * `headerExtra` is rendered in a flex row alongside the title — used by the
 * wallet tab for filter pills.
 */
export interface DataTableCardProps<T> {
  title?: ReactNode;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, rowIndex: number) => string;
  /** Empty-state message used when `isFiltered` is true. */
  emptyFilteredMessage?: string;
  /** Empty-state message used when no filter is active. */
  emptyMessage?: string;
  /** When true, prefer `emptyFilteredMessage` over `emptyMessage`. */
  isFiltered?: boolean;
  /** Optional content rendered next to the title (filter pills, actions). */
  headerExtra?: ReactNode;
}

export function DataTableCard<T>({
  title,
  columns,
  rows,
  rowKey,
  emptyFilteredMessage,
  emptyMessage,
  isFiltered = false,
  headerExtra,
}: DataTableCardProps<T>) {
  const isEmpty = rows.length === 0;
  const emptyText = (isFiltered ? emptyFilteredMessage : emptyMessage) ?? emptyMessage ?? emptyFilteredMessage;

  // ponytail: static lookup — `text-${align}` template strings get purged by Tailwind JIT.
  const ALIGN: Record<NonNullable<Column<T>["align"]>, string> = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  };

  return (
    <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
      {(title || headerExtra) && (
        <CardHeader>
          {headerExtra ? (
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              {headerExtra}
            </div>
          ) : (
            <CardTitle className="text-base">{title}</CardTitle>
          )}
        </CardHeader>
      )}
      <CardContent>
        {isEmpty ? (
          <p className="py-8 text-center text-muted-foreground">{emptyText}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60">
                  {columns.map((col, i) => (
                    <th
                      key={i}
                      className={`py-2 font-medium ${ALIGN[col.align ?? "left"]}`}
                    >
                      {col.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIndex) => (
                  <tr
                    key={rowKey(row, rowIndex)}
                    className="border-b border-border/40 transition-colors last:border-0 hover:bg-muted/30"
                  >
                    {columns.map((col, i) => (
                      <td
                        key={i}
                        className={`py-2.5 ${ALIGN[col.align ?? "left"]}${col.className ? ` ${col.className}` : ""}`}
                      >
                        {col.render(row, rowIndex)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
