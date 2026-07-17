"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Search,
  Save,
  Trash2,
  CheckCircle2,
  XCircle,
  MinusCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface FlagDetail {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  category: string;
  updatedAt: string;
  overrides: Override[];
}

interface Override {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  enabled: boolean;
  reason: string | null;
  updatedAt: string;
}

interface TenantRow {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  overrideEnabled: boolean | null;
  reason: string | null;
  effective: boolean;
}

export function FlagDetailManager({ flagId }: { flagId: string }) {
  const [flag, setFlag] = useState<FlagDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingMeta, setSavingMeta] = useState(false);

  // Editable metadata form
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [enabled, setEnabled] = useState(false);

  // Tenant search
  const [q, setQ] = useState("");
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [overrideOnly, setOverrideOnly] = useState(false);
  const [searching, setSearching] = useState(false);
  const [pendingOverride, setPendingOverride] = useState<Record<string, { enabled: boolean; reason: string }>>({});

  const fetchFlag = useCallback(() => {
    setLoading(true);
    apiFetch<{ flag: FlagDetail }>(`/api/super-admin/feature-flags/${flagId}`)
      .then((r) => {
        const f = r.data?.flag;
        if (!f) return;
        setFlag(f);
        setName(f.name);
        setDescription(f.description ?? "");
        setCategory(f.category);
        setEnabled(f.enabled);
      })
      .catch((err) =>
        toast.error(
          err instanceof ApiClientError ? err.message : "Failed to load flag",
        ),
      )
      .finally(() => setLoading(false));
  }, [flagId]);

  const fetchTenants = useCallback(() => {
    setSearching(true);
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (overrideOnly) params.set("overrideOnly", "true");
    apiFetch<{ tenants: TenantRow[] }>(
      `/api/super-admin/feature-flags/${flagId}/tenants?${params}`,
    )
      .then((r) => setTenants(r.data?.tenants ?? []))
      .catch((err) =>
        toast.error(
          err instanceof ApiClientError ? err.message : "Failed to load tenants",
        ),
      )
      .finally(() => setSearching(false));
  }, [flagId, q, overrideOnly]);

  useEffect(() => {
    fetchFlag();
  }, [fetchFlag]);

  useEffect(() => {
    const t = setTimeout(fetchTenants, 250);
    return () => clearTimeout(t);
  }, [fetchTenants]);

  async function saveMeta() {
    setSavingMeta(true);
    try {
      await apiFetch(`/api/super-admin/feature-flags/${flagId}`, {
        method: "PATCH",
        body: {
          name,
          description: description || null,
          category,
          enabled,
        },
      });
      toast.success("Flag updated");
      fetchFlag();
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to update",
      );
    } finally {
      setSavingMeta(false);
    }
  }

  async function applyOverride(tenant: TenantRow, enabledVal: boolean) {
    const reason = pendingOverride[tenant.tenantId]?.reason?.trim() || "";
    try {
      await apiFetch(`/api/super-admin/feature-flags/${flagId}/tenants`, {
        method: "POST",
        body: { tenantId: tenant.tenantId, enabled: enabledVal, reason: reason || null },
      });
      toast.success(
        `${tenant.tenantName}: ${enabledVal ? "whitelisted" : "blacklisted"}`,
      );
      fetchFlag();
      fetchTenants();
      setPendingOverride((p) => {
        const next = { ...p };
        delete next[tenant.tenantId];
        return next;
      });
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to set override",
      );
    }
  }

  async function removeOverride(tenantId: string, tenantName: string) {
    try {
      await apiFetch(
        `/api/super-admin/feature-flags/${flagId}/tenants/${tenantId}`,
        { method: "DELETE" },
      );
      toast.success(`${tenantName}: override removed (inherits global)`);
      fetchFlag();
      fetchTenants();
    } catch (err) {
      toast.error(
        err instanceof ApiClientError ? err.message : "Failed to remove override",
      );
    }
  }

  if (loading || !flag) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Metadata */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="flag-key">Key</Label>
            <Input id="flag-key" value={flag.key} disabled className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flag-name">Name</Label>
            <Input
              id="flag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="flag-category">Category</Label>
            <Input
              id="flag-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Global default</Label>
            <div className="flex h-9 items-center gap-3">
              <Switch
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <span className="text-sm text-muted-foreground">
                {enabled ? "ON for everyone (unless overridden)" : "OFF for everyone (unless whitelisted)"}
              </span>
            </div>
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="flag-desc">Description</Label>
            <Input
              id="flag-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this flag control?"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={saveMeta} disabled={savingMeta}>
            {savingMeta && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </section>

      {/* Existing overrides */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-sm font-semibold">
            Current overrides ({flag.overrides.length})
          </h2>
        </div>
        {flag.overrides.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No per-tenant overrides. All tenants inherit the global default.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {flag.overrides.map((o) => (
              <li
                key={o.id}
                className="flex items-center justify-between gap-3 px-5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{o.tenantName}</span>
                    <span className="text-xs text-muted-foreground">
                      {o.tenantSlug}
                    </span>
                  </div>
                  {o.reason && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {o.reason}
                    </p>
                  )}
                </div>
                <Badge variant={o.enabled ? "default" : "destructive"}>
                  {o.enabled ? "Force ON" : "Force OFF"}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeOverride(o.tenantId, o.tenantName)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Tenant search + apply */}
      <section className="rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search tenants by name or slug..."
              className="pl-9"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={overrideOnly}
              onCheckedChange={setOverrideOnly}
            />
            Overridden only
          </label>
        </div>

        {searching ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : tenants.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">
            No tenants match.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tenants.map((t) => {
              const draft = pendingOverride[t.tenantId];
              return (
                <li
                  key={t.tenantId}
                  className="flex flex-wrap items-center gap-3 px-5 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{t.tenantName}</span>
                      <span className="text-xs text-muted-foreground">
                        {t.tenantSlug}
                      </span>
                    </div>
                    {t.overrideEnabled !== null && t.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Current: {t.reason}
                      </p>
                    )}
                  </div>

                  {t.overrideEnabled !== null && (
                    <Badge variant="outline" className="gap-1">
                      {t.overrideEnabled ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-destructive" />
                      )}
                      {t.overrideEnabled ? "ON" : "OFF"}
                    </Badge>
                  )}

                  <Input
                    placeholder="Reason (optional)"
                    value={draft?.reason ?? ""}
                    onChange={(e) =>
                      setPendingOverride((p) => ({
                        ...p,
                        [t.tenantId]: {
                          enabled: draft?.enabled ?? !t.effective,
                          reason: e.target.value,
                        },
                      }))
                    }
                    className="h-8 w-40 text-xs"
                  />

                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300"
                      onClick={() => applyOverride(t, true)}
                    >
                      Whitelist
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300"
                      onClick={() => applyOverride(t, false)}
                    >
                      Blacklist
                    </Button>
                    {t.overrideEnabled !== null && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => removeOverride(t.tenantId, t.tenantName)}
                        title="Remove override (inherit global)"
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
