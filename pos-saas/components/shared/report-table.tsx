interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  format?: (value: unknown, row: T) => React.ReactNode;
}

interface ReportTableProps<T> {
  columns: Column<T>[];
  data: T[];
  summaryRow?: T | null;
  summaryLabel?: string;
  emptyMessage?: string;
}

export function ReportTable<T extends Record<string, unknown>>({
  columns,
  data,
  summaryRow,
  summaryLabel,
  emptyMessage = "No data for this period",
}: ReportTableProps<T>) {
  if (data.length === 0 && !summaryRow) {
    return <p className="text-center py-8 text-muted-foreground text-sm">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-primary/10 border-b-2 border-primary/20">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-3 px-4 font-semibold text-primary whitespace-nowrap ${
                  col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className={`border-b border-border/50 ${i % 2 === 0 ? "bg-card" : "bg-muted/30"} hover:bg-accent/30 transition-colors`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`py-3 px-4 ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {col.format ? col.format(row[col.key], row) : String(row[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
          {summaryRow && (
            <tr className="bg-primary/5 border-t-2 border-primary/30">
              {columns.map((col, i) => (
                <td
                  key={col.key}
                  className={`py-3 px-4 font-bold ${
                    col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left"
                  }`}
                >
                  {i === 0 && summaryLabel ? summaryLabel : col.format ? col.format(summaryRow[col.key], summaryRow) : String(summaryRow[col.key] ?? "")}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
