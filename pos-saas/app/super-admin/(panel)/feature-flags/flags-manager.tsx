"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Search, Pencil, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface Flag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  category: string;
  overrideCount: number;
  updatedAt: string;
}

const CATEGORY_COLOR: Record<string, string> = {
  general: "bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-300",
  operations: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  admin: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
  growth: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
};

export function FlagsManager() {
  const router = useRouter();
  const [flags, setFlags] = useState<Flag[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchFlags = useCallback(() => {
    setLoading(true);
    apiFetch<{ flags: Flag[] }>("/api/super-admin/feature-flags")
      .then((r) => setFlags(r.data?.flags ?? []))
      .catch((err) =>
        toast.error(
          err instanceof ApiClientError ? err.message : "Failed to load flags.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  async function toggleEnabled(flag: Flag, next: boolean) {
    setTogglingId(flag.id);
    // Optimistic update
    setFlags((prev) =>
      prev.map((f) => (f.id === flag.id ? { ...f, enabled: next } : f)),
    );
    try {
      await apiFetch(`/api/super-admin/feature-flags/${flag.id}`, {
        method: "PATCH",
        body: { enabled: next },
      });
      toast.success(`${flag.name} ${next ? "enabled" : "disabled"} globally`);
    } catch (err) {
      // Revert
      setFlags((prev) =>
        prev.map((f) => (f.id === flag.id ? { ...f, enabled: !next } : f)),
      );
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to update flag",
      );
    } finally {
      setTogglingId(null);
    }
  }

  const filtered =
    q.trim() === ""
      ? flags
      : flags.filter(
          (f) =>
            f.key.toLowerCase().includes(q.toLowerCase()) ||
            f.name.toLowerCase().includes(q.toLowerCase()) ||
            f.category.toLowerCase().includes(q.toLowerCase()),
        );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search flags..."
          className="pl-9"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Flag</th>
              <th className="px-3 py-3 text-left font-semibold">Category</th>
              <th className="px-3 py-3 text-center font-semibold">Global</th>
              <th className="px-3 py-3 text-right font-semibold">Overrides</th>
              <th className="px-3 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((f) => (
              <tr
                key={f.id}
                className="transition-colors hover:bg-muted/30"
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{f.name}</div>
                  <div className="text-xs font-mono text-muted-foreground">
                    {f.key}
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${
                      CATEGORY_COLOR[f.category] ?? CATEGORY_COLOR.general
                    }`}
                  >
                    {f.category}
                  </span>
                </td>
                <td className="px-3 py-3 text-center">
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={(v) => toggleEnabled(f, v)}
                    disabled={togglingId === f.id}
                  />
                </td>
                <td className="px-3 py-3 text-right">
                  {f.overrideCount > 0 ? (
                    <Badge variant="secondary">
                      <Users className="mr-1 h-3 w-3" />
                      {f.overrideCount}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/super-admin/feature-flags/${f.id}`)
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <Pencil className="h-3 w-3" />
                    Manage
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Flag changes take effect when affected users refresh their session
        (re-login, or admin triggers a session-version bump).
      </p>
    </div>
  );
}
