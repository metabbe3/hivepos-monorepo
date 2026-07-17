"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ponytail: one component for all 3 export endpoints. Pass URL + filename hint.
// Uses fetch + blob so we can show a spinner and toast errors; <a href> wouldn't show errors.
export function CsvExportButton({
  url,
  label,
}: {
  url: string;
  label?: string;
}) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const res = await fetch(url, { method: "GET" });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error?.message ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      // Pull filename from Content-Disposition, fall back to a generic name.
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="?([^";]+)"?/);
      const filename = match?.[1] ?? "export.csv";

      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objUrl);
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-60"
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {label ?? "Export CSV"}
    </button>
  );
}
