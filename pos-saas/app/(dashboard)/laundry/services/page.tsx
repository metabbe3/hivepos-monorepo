"use client";

import { useEffect, useMemo, useState } from "react";
import { usePermissionGuard } from "@/hooks/use-permission-guard";
import { toast } from "sonner";
import { useTranslation } from "@/hooks/use-translation";
import { Pencil, Trash2, Weight, Package, FolderOpen, ChevronDown, ChevronRight, Layers, Clock, Zap, Timer, Sparkles, Star } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { PageLoading } from "@/components/shared/loading";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField } from "@/components/shared/form-field";
import { CardListItem } from "@/components/shared/card-list";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency } from "@/lib/format";
import { PRICING_TYPE_LABELS, SERVICE_CATEGORIES } from "@/lib/constants";
import { transformServices, getBaseItemCategories, filterBaseItems } from "@/lib/service-transformer";
import { DynamicForm } from "@/lib/forms/dynamic-form";
import { serviceSchema } from "@/lib/forms/schemas";
import { apiFetch, ApiClientError } from "@/modules/shared";

interface Service {
  id: string;
  name: string;
  description: string | null;
  pricingType: "PER_KG" | "PER_ITEM";
  basePrice: number;
  commissionType: "NONE" | "FLAT" | "PERCENTAGE";
  commissionValue: number;
  isActive: boolean;
  isDefaultSpeed: boolean;
  groupId: string | null;
  group: { id: string; name: string } | null;
}

interface ServiceGroup {
  id: string;
  name: string;
  sortOrder: number;
  serviceCount?: number;
}

const SPEED_LABELS: Record<string, { icon: React.ReactNode; color: string }> = {
  reguler: {
    icon: <Clock className="h-3.5 w-3.5" />,
    color: "text-emerald-600 bg-emerald-50 border-emerald-200",
  },
  express24: {
    icon: <Zap className="h-3.5 w-3.5" />,
    color: "text-amber-600 bg-amber-50 border-amber-200",
  },
  express7: {
    icon: <Timer className="h-3.5 w-3.5" />,
    color: "text-red-600 bg-red-50 border-red-200",
  },
  standalone: {
    icon: null,
    color: "",
  },
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Grouped view state
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Batch create state
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchForm, setBatchForm] = useState({
    baseName: "",
    pricingType: "PER_ITEM" as "PER_KG" | "PER_ITEM",
    speeds: { reguler: true, express24: false, express7: false },
    prices: { reguler: "", express24: "", express7: "" },
    commissionType: "NONE" as "NONE" | "FLAT" | "PERCENTAGE",
    commissionValue: "",
    groupId: "",
  });

  // Group management dialog
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<ServiceGroup | null>(null);
  const [editGroupName, setEditGroupName] = useState("");

  const { allowed, isLoading: roleLoading } = usePermissionGuard("services", "read", "/laundry/orders");
  const { t } = useTranslation();

  async function loadData() {
    try {
      const [svcs, groups] = await Promise.all([
        apiFetch<Service[]>("/api/services?includeInactive=true"),
        apiFetch<ServiceGroup[]>("/api/service-groups"),
      ]);
      setServices(svcs.data ?? []);
      setServiceGroups(groups.data ?? []);
    } catch {
      setServices([]);
      setServiceGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  // Transform services into grouped base items
  const baseItems = useMemo(() => {
    const activeServices = services.filter((s) => s.isActive);
    return transformServices(activeServices as Parameters<typeof transformServices>[0]);
  }, [services]);

  // Build a lookup from serviceId to Service for the flat list
  const serviceMap = useMemo(() => {
    const map = new Map<string, Service>();
    for (const s of services) map.set(s.id, s);
    return map;
  }, [services]);

  // Filtered base items
  const filteredItems = useMemo(() => {
    return filterBaseItems(baseItems, search, categoryFilter);
  }, [baseItems, search, categoryFilter]);

  // Category counts for tabs
  const categoryCounts = useMemo(() => getBaseItemCategories(baseItems), [baseItems]);

  if (roleLoading || !allowed) return null;

  function toggleExpanded(key: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openBatchCreate() {
    setBatchForm({
      baseName: "", pricingType: "PER_ITEM",
      speeds: { reguler: true, express24: false, express7: false },
      prices: { reguler: "", express24: "", express7: "" },
      commissionType: "NONE", commissionValue: "", groupId: "",
    });
    setBatchDialogOpen(true);
  }

  function openEdit(s: Service) {
    setEditing(s);
    setDialogOpen(true);
  }

  async function toggleActive(s: Service) {
    try {
      await apiFetch(`/api/services/${s.id}`, { method: "PATCH", body: { isActive: !s.isActive } });
      toast.success(s.isActive ? t("services.deactivated") : t("services.activated"));
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("services.failedUpdate"));
    }
  }

  async function setDefaultSpeed(targetId: string, previousDefaultId: string | null) {
    // Client-side two-PATCH switch (see docs/specs/service-default-speed.md):
    // clear the previous default in this speed-group, then set the target.
    try {
      if (previousDefaultId && previousDefaultId !== targetId) {
        await apiFetch(`/api/services/${previousDefaultId}`, { method: "PATCH", body: { isDefaultSpeed: false } });
      }
      await apiFetch(`/api/services/${targetId}`, { method: "PATCH", body: { isDefaultSpeed: true } });
      toast.success(t("services.defaultSet"));
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("services.failedUpdate"));
    }
  }

  async function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const speeds: { key: "reguler" | "express24" | "express7"; suffix: string }[] = [
      { key: "reguler", suffix: " Reguler" },
      { key: "express24", suffix: " Express 24 Jam" },
      { key: "express7", suffix: " Express 7 Jam" },
    ];

    const toCreate = speeds.filter(({ key }) => batchForm.speeds[key] && batchForm.prices[key]);
    if (toCreate.length === 0) {
      toast.error(t("services.batchFailed"));
      return;
    }

    const commissionValue = batchForm.commissionType !== "NONE" && batchForm.commissionValue
      ? parseFloat(batchForm.commissionValue) : 0;

    try {
      let created = 0;
      for (const { key, suffix } of toCreate) {
        try {
          await apiFetch("/api/services", {
            method: "POST",
            body: {
              name: batchForm.baseName.trim() + suffix,
              pricingType: batchForm.pricingType,
              basePrice: parseFloat(batchForm.prices[key]),
              commissionType: batchForm.commissionType,
              commissionValue,
              groupId: batchForm.groupId || undefined,
              isDefaultSpeed: key === "reguler",
            },
          });
          created++;
        } catch {
          // Skip individual failures so partial batch can still succeed
        }
      }
      toast.success(t("services.batchCreated").replace("{count}", String(created)));
      setBatchDialogOpen(false);
      loadData();
    } catch {
      toast.error(t("services.batchFailed"));
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    try {
      await apiFetch("/api/service-groups", { method: "POST", body: { name: newGroupName.trim() } });
      toast.success(t("services.groupCreated"));
      setNewGroupName("");
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("services.failedSave"));
    }
  }

  async function renameGroup() {
    if (!editingGroup || !editGroupName.trim()) return;
    try {
      await apiFetch(`/api/service-groups/${editingGroup.id}`, { method: "PATCH", body: { name: editGroupName.trim() } });
      toast.success(t("services.groupUpdated"));
      setEditingGroup(null);
      setEditGroupName("");
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("services.failedUpdate"));
    }
  }

  async function deleteGroup(g: ServiceGroup) {
    try {
      await apiFetch(`/api/service-groups/${g.id}`, { method: "DELETE" });
      toast.success(t("services.groupDeleted"));
      loadData();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("services.failedUpdate"));
    }
  }

  if (loading) return <PageLoading />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("services.title")}
        description={t("services.description")}
        actions={[
          { label: t("services.batchCreate"), onClick: openBatchCreate, variant: "outline" as const },
          { label: t("services.addService"), onClick: openCreate },
        ]}
      />

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder={t("newOrder.searchServicePlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex gap-2">
          {SERVICE_CATEGORIES.map((cat) => {
            const count = cat.id === "all"
              ? baseItems.length
              : categoryCounts.find((c) => c.id === cat.id)?.count ?? 0;
            if (cat.id !== "all" && count === 0) return null;
            return (
              <button
                key={cat.id}
                type="button"
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0 ${
                  categoryFilter === cat.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted"
                }`}
                onClick={() => setCategoryFilter(cat.id)}
              >
                {t(cat.labelKey)} {count > 0 && <span className="opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-all shrink-0 bg-muted/60 text-muted-foreground hover:bg-muted flex items-center gap-1"
          onClick={() => setGroupDialogOpen(true)}
        >
          <FolderOpen className="h-3 w-3" />
          {t("services.manageGroups")}
        </button>
      </div>

      {/* Grouped base items grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 overflow-hidden">
        {filteredItems.map((item) => {
          const isExpanded = expandedItems.has(item.baseName);
          const priceLabel = item.priceRange.min === item.priceRange.max
            ? formatCurrency(item.priceRange.min)
            : `${formatCurrency(item.priceRange.min)} — ${formatCurrency(item.priceRange.max)}`;
          const variantCount = item.variants.length;

          return (
            <CardListItem key={item.baseName} interactive className="min-w-0 overflow-hidden">
              <CardHeader
                className="flex flex-row items-start justify-between space-y-0 pb-2 cursor-pointer"
                onClick={() => toggleExpanded(item.baseName)}
              >
                <div className="flex items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    item.pricingType === "PER_KG"
                      ? "bg-[oklch(0.93_0.035_80)] dark:bg-[oklch(0.28_0.04_65)]"
                      : "bg-[oklch(0.95_0.02_85)] dark:bg-[oklch(0.26_0.025_55)]"
                  }`}>
                    {item.pricingType === "PER_KG" ? (
                      <Weight className="h-4 w-4 text-brand-600" />
                    ) : (
                      <Package className="h-4 w-4 text-[oklch(0.68_0.12_40)]" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base break-words">{item.baseName}</CardTitle>
                    <p className="text-sm font-semibold mt-0.5">{priceLabel}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {variantCount > 1 && (
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <Layers className="h-3 w-3" />
                      {variantCount} {t("services.variants")}
                    </Badge>
                  )}
                  <Badge variant="default" className="bg-brand-600 text-white text-[10px]">
                    {t(PRICING_TYPE_LABELS[item.pricingType])}
                  </Badge>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>

              {/* Expanded variants */}
              {isExpanded && (
                <CardContent className="pt-0 pb-3">
                  <div className="space-y-1.5 border-t border-border/40 pt-2">
                    {item.variants.map((variant) => {
                      const svc = serviceMap.get(variant.serviceId);
                      const speedStyle = SPEED_LABELS[variant.speed];
                      const isInactive = svc && !svc.isActive;

                      return (
                        <div
                          key={variant.serviceId}
                          className={`flex items-center justify-between rounded-lg px-3 py-2 border transition-colors ${
                            isInactive
                              ? "border-border/20 bg-muted/30 opacity-60"
                              : speedStyle.color ? `border ${speedStyle.color}` : "border-border/40"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {speedStyle.icon && <span className="shrink-0">{speedStyle.icon}</span>}
                            <div className="min-w-0">
                              <span className="text-sm font-medium truncate block">{variant.name}</span>
                              {isInactive && (
                                <span className="text-[10px] text-muted-foreground">{t("services.inactive")}</span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm font-bold">{formatCurrency(variant.basePrice)}</span>
                            {variantCount > 1 && variant.isDefault && (
                              <Badge variant="secondary" className="gap-1 text-[10px] bg-amber-100 text-amber-700 hover:bg-amber-100">
                                <Star className="h-3 w-3 fill-current" />
                                {t("services.defaultLabel")}
                              </Badge>
                            )}
                            {svc && (
                              <div className="flex gap-0.5">
                                {variantCount > 1 && !variant.isDefault && (
                                  <Tooltip>
                                    <TooltipTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={(e) => { e.stopPropagation(); setDefaultSpeed(variant.serviceId, item.variants.find((v) => v.isDefault)?.serviceId ?? null); }}
                                        />
                                      }
                                    >
                                      <Star className="h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent>{t("services.setDefaultHint")}</TooltipContent>
                                  </Tooltip>
                                )}
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); openEdit(svc); }}>
                                  <Pencil className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); toggleActive(svc); }}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </CardListItem>
          );
        })}
      </div>

      {filteredItems.length === 0 && !search && (
        <EmptyState
          icon={Package}
          title={t("services.noGroups")}
          description={t("services.description")}
          action={{ label: t("services.addService"), onClick: openCreate }}
        />
      )}
      {filteredItems.length === 0 && search && (
        <EmptyState
          icon={Package}
          title={t("newOrder.noServicesFound")}
          description={t("newOrder.searchServicePlaceholder")}
        />
      )}

      {/* Service create/edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {editing ? t("services.editService") : t("services.addService")}
            </DialogTitle>
          </DialogHeader>
          <DynamicForm
            schema={{
              ...serviceSchema,
              fields: serviceSchema.fields.map((f) =>
                f.name === "groupId"
                  ? {
                      ...f,
                      // Ponytail: skip group field entirely if no groups exist (matches old conditional render).
                      hidden: serviceGroups.length === 0,
                      options: [{ label: t("services.noGroup"), value: "__none" }, ...serviceGroups.map((g) => ({ label: g.name, value: g.id }))],
                    }
                  : f
              ),
            }}
            initialData={editing ? {
              name: editing.name,
              description: editing.description ?? "",
              pricingType: editing.pricingType,
              basePrice: String(editing.basePrice),
              commissionType: editing.commissionType,
              commissionValue: editing.commissionValue ? String(editing.commissionValue) : "",
              groupId: editing.groupId ?? "__none",
            } : { groupId: "__none" }}
            recordId={editing?.id}
            onCancel={() => setDialogOpen(false)}
            onSuccess={() => {
              setDialogOpen(false);
              loadData();
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Batch Create dialog */}
      <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {t("services.batchCreate")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBatchSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t("services.baseName")} required>
                <Input
                  value={batchForm.baseName}
                  onChange={(e) => setBatchForm({ ...batchForm, baseName: e.target.value })}
                  placeholder="e.g. Kemeja"
                  required
                />
              </FormField>
              <FormField label={t("services.pricingType")}>
                <Select
                  value={batchForm.pricingType}
                  onValueChange={(v) => v && setBatchForm({ ...batchForm, pricingType: v as "PER_KG" | "PER_ITEM" })}
                  items={[
                    { value: "PER_KG", label: t("pricingType.perKg") },
                    { value: "PER_ITEM", label: t("pricingType.perItem") },
                  ]}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_KG">{t("pricingType.perKg")}</SelectItem>
                    <SelectItem value="PER_ITEM">{t("pricingType.perItem")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>

            <div className="rounded-lg bg-muted/30 border border-border/30 p-3 space-y-3">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("services.speedVariants")}</Label>
              {[
                { key: "reguler" as const, label: "Reguler", icon: <Clock className="h-4 w-4 text-emerald-600" /> },
                { key: "express24" as const, label: "Express 24 Jam", icon: <Zap className="h-4 w-4 text-amber-600" /> },
                { key: "express7" as const, label: "Express 7 Jam", icon: <Timer className="h-4 w-4 text-red-600" /> },
              ].map(({ key, label, icon }) => (
                <div key={key} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                  batchForm.speeds[key]
                    ? "border-primary/30 bg-primary/5"
                    : "border-border/40"
                }`}>
                  <Checkbox
                    checked={batchForm.speeds[key]}
                    onCheckedChange={(checked) =>
                      setBatchForm({
                        ...batchForm,
                        speeds: { ...batchForm.speeds, [key]: !!checked },
                      })
                    }
                  />
                  <span className="shrink-0">{icon}</span>
                  <span className="text-sm font-medium flex-1">{label}</span>
                  <Input
                    type="number"
                    placeholder="Rp"
                    value={batchForm.prices[key]}
                    onChange={(e) =>
                      setBatchForm({
                        ...batchForm,
                        prices: { ...batchForm.prices, [key]: e.target.value },
                      })
                    }
                    className="h-8 w-28 text-sm"
                    disabled={!batchForm.speeds[key]}
                    required={batchForm.speeds[key]}
                  />
                </div>
              ))}
            </div>

            {serviceGroups.length > 0 && (
              <FormField label={t("services.group")}>
                <Select
                  value={batchForm.groupId || "__none"}
                  onValueChange={(v) => v && setBatchForm({ ...batchForm, groupId: v === "__none" ? "" : v })}
                  items={[
                    { value: "__none", label: t("services.noGroup") },
                    ...serviceGroups.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">{t("services.noGroup")}</SelectItem>
                    {serviceGroups.map((g) => (
                      <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label={t("services.commissionType")}>
                <Select
                  value={batchForm.commissionType}
                  onValueChange={(v) => v && setBatchForm({ ...batchForm, commissionType: v as "NONE" | "FLAT" | "PERCENTAGE", commissionValue: v === "NONE" ? "" : batchForm.commissionValue })}
                  items={[
                    { value: "NONE", label: t("commissionType.none") },
                    { value: "FLAT", label: t("commissionType.flat") },
                    { value: "PERCENTAGE", label: t("commissionType.percentage") },
                  ]}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">{t("commissionType.none")}</SelectItem>
                    <SelectItem value="FLAT">{t("commissionType.flat")}</SelectItem>
                    <SelectItem value="PERCENTAGE">{t("commissionType.percentage")}</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
              {batchForm.commissionType !== "NONE" && (
                <FormField label={batchForm.commissionType === "FLAT" ? t("services.commissionRp") : t("services.commissionPercent")} required>
                  <Input
                    type="number"
                    value={batchForm.commissionValue}
                    onChange={(e) => setBatchForm({ ...batchForm, commissionValue: e.target.value })}
                    placeholder={batchForm.commissionType === "FLAT" ? t("services.placeholderFlat") : t("services.placeholderPercent")}
                    required
                  />
                </FormField>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full sm:w-auto bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105">
                <Sparkles className="h-4 w-4 mr-2" />
                {t("services.batchCreate")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Group management dialog */}
      <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("services.manageGroups")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder={t("services.newGroupPlaceholder")}
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), createGroup())}
              />
              <Button onClick={createGroup} disabled={!newGroupName.trim()}>{t("common.create")}</Button>
            </div>
            {serviceGroups.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">{t("services.noGroups")}</p>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {serviceGroups.map((g) => (
                <div key={g.id} className="flex items-center justify-between rounded-lg border border-border/40 px-3 py-2">
                  {editingGroup?.id === g.id ? (
                    <div className="flex gap-2 flex-1">
                      <Input
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && renameGroup()}
                        className="h-8 text-sm"
                        autoFocus
                      />
                      <Button size="sm" onClick={renameGroup}>{t("common.save")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingGroup(null)}>{t("common.cancel")}</Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{g.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {g.serviceCount ?? 0} {t("services.serviceCount")}
                        </Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingGroup(g); setEditGroupName(g.name); }}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteGroup(g)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
