import Link from "next/link";
import { cn } from "@/lib/utils";
import { EmptyState } from "./empty-state";
import { type LucideIcon } from "lucide-react";

export type Column<T> = {
  key: string;
  header: React.ReactNode;
  align?: "left" | "right" | "center";
  width?: string;
  render: (row: T, index: number) => React.ReactNode;
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  getRowHref,
  getRowKey,
  rowActions,
  emptyState,
  className,
  stickyHeader = false,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowHref?: (row: T) => string;
  getRowKey?: (row: T, index: number) => string;
  rowActions?: (row: T) => React.ReactNode;
  emptyState?: { icon: LucideIcon; title: string; hint?: string; action?: React.ReactNode };
  className?: string;
  stickyHeader?: boolean;
}) {
  const alignClass = { left: "text-left", right: "text-right", center: "text-center" };
  return (
    // ponytail: shadcn Card wrapper + soft row hover. No black bar, no zebra.
    <div className={cn("overflow-hidden rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10 shadow-sm", className)}>
      <div className="overflow-x-auto">
        <table className="w-full caption-bottom text-sm">
          <thead className={cn(stickyHeader && "sticky top-0 z-10 bg-card")}>
            <tr className="border-b border-border/60 [&>th]:h-10 [&>th]:px-3 [&>th]:text-left [&>th]:align-middle [&>th]:font-medium [&>th]:whitespace-nowrap [&>th]:text-foreground">
              {columns.map((c) => (
                <th key={c.key} style={{ width: c.width }} className={alignClass[c.align ?? "left"]}>
                  {c.header}
                </th>
              ))}
              {rowActions && <th className="w-12 px-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="p-0">
                  {emptyState ? (
                    <EmptyState
                      icon={emptyState.icon}
                      title={emptyState.title}
                      hint={emptyState.hint}
                      action={emptyState.action}
                    />
                  ) : (
                    <div className="py-10 text-center text-muted-foreground">No data.</div>
                  )}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const href = getRowHref?.(row);
                const key = getRowKey?.(row, i) ?? (row as any).id ?? String(i);
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b border-border/40 transition-colors last:border-0 hover:bg-muted/50",
                      href && "cursor-pointer",
                    )}
                  >
                    {columns.map((c, ci) => (
                      <td
                        key={c.key}
                        className={cn(
                          "p-2.5 align-middle whitespace-nowrap",
                          alignClass[c.align ?? "left"],
                          ci === 0 && href && "font-medium",
                        )}
                      >
                        {href && ci === 0 ? (
                          <Link href={href} className="hover:underline">
                            {c.render(row, i)}
                          </Link>
                        ) : (
                          c.render(row, i)
                        )}
                      </td>
                    ))}
                    {rowActions && <td className="p-2.5 text-right">{rowActions(row)}</td>}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
