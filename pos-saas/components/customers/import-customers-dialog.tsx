"use client";

import { useState } from "react";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { parseCSV, toCSV } from "@/lib/csv";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

const HEADERS = ["name", "phone", "email", "notes"];

type ImportSummary = {
  imported: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

export function ImportCustomersDialog({ open, onOpenChange, onImported }: Props) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [busy, setBusy] = useState(false);

  function handleFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const grid = parseCSV(String(reader.result ?? ""));
      if (grid.length === 0) {
        setRows([]);
        return;
      }
      // Map by header name; fall back to positional columns.
      const header = grid[0].map((h) => h.trim().toLowerCase());
      const idx = (key: string, fallback: number) => {
        const i = header.indexOf(key);
        return i >= 0 ? i : fallback;
      };
      const ni = idx("name", 0);
      const pi = idx("phone", 1);
      const ei = idx("email", 2);
      const si = idx("notes", 3);
      const hasHeader = header.some((h) => HEADERS.includes(h));
      const dataRows = hasHeader ? grid.slice(1) : grid;
      const mapped = dataRows
        .map((r) => ({
          name: r[ni] ?? "",
          phone: r[pi] ?? "",
          email: r[ei] ?? "",
          notes: r[si] ?? "",
        }))
        .filter((r) => r.name.trim() !== "");
      setRows(mapped);
    };
    reader.readAsText(file);
  }

  function downloadTemplate() {
    const csv = toCSV(HEADERS, [["Budi", "081234567890", "budi@email.com", "Pelanggan VIP"]]);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hivepos-customer-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function doImport() {
    setBusy(true);
    try {
      const res = await apiFetch<ImportSummary>("/api/customers/import", {
        method: "POST",
        body: { rows },
      });
      const { imported, skipped, errors } = res.data;
      toast.success(
        t("customers.importSummary")
          .replace("{imported}", String(imported))
          .replace("{skipped}", String(skipped)),
      );
      if (errors.length > 0) {
        toast.warning(t("customers.importErrors").replace("{n}", String(errors.length)));
      }
      onImported();
      onOpenChange(false);
      setRows([]);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("customers.importFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t("customers.importTitle")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("customers.importHelp")}</p>
          <label className="block cursor-pointer">
            <span className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 px-4 py-6 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground">
              <Upload className="h-4 w-4" />
              {t("customers.importChoose")}
            </span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="mr-1 h-4 w-4" />
            {t("customers.importTemplate")}
          </Button>
          {rows.length > 0 && (
            <p className="text-sm font-medium">
              {t("customers.importReady").replace("{n}", String(rows.length))}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={doImport}
            disabled={busy || rows.length === 0}
            className="bg-gradient-to-r from-brand-600 to-brand-700 text-white"
          >
            {busy ? "…" : t("customers.importButton")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
