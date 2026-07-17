"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import Script from "next/script";
import { toast } from "sonner";
import {
  CreditCard,
  Gift,
  CheckCircle2,
  Loader2,
  Tag,
  Building2,
  Calendar,
  Sparkles,
  History,
  Store,
  ChevronDown,
  Lock,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { FormField } from "@/components/shared/form-field";
import { CardListItem } from "@/components/shared/card-list";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { ReferralCard } from "@/components/billing/referral-card";
import { useTranslation } from "@/hooks/use-translation";

// ── Types ──
interface Outlet {
  id: string;
  name: string;
  coverageEnd: string | null;
  isFreeTier: boolean;
  status: "FREE" | "ACTIVE" | "LOCKED" | "EXPIRING";
  expiresInDays: number | null;
}

interface BillingStatus {
  tenant: { name: string; slug: string; ownerEmail: string; activeModules: string[] };
  subscription: {
    status: string;
    planName: string;
    currentPeriodEnd: string | null;
  } | null;
  outlets: Outlet[];
  activeCount: number;
  lockedCount: number;
  expiringSoon: Array<{
    id: string;
    name: string;
    coverageEnd: string;
    expiresInDays: number;
  }>;
  trialEndsAt: string | null;
  pricing: { unitPrice: number; originalUnitPrice: number };
  limits: {
    maxOutlets: number;
    maxUsers: number;
    maxOrders: number;
    isPaid: boolean;
    planName: string;
  };
  payments: Array<{
    id: string;
    amount: number;
    outletCount: number;
    monthsPurchased: number;
    status: string;
    kind: string;
    branchIds: string[];
    paidAt: string | null;
    midtransOrderId: string | null;
    createdAt: string;
  }>;
}

interface PromoPreview {
  valid: boolean;
  error?: string;
  promoCode?: { code: string; type: string; description: string | null };
  calculation?: {
    unitPrice: number;
    originalUnitPrice: number;
    outletCount: number;
    months: number;
    grossTotal: number;
    discount: number;
    total: number;
    freeMonths: number;
  };
}

declare global {
  interface Window {
    snap?: {
      pay: (token: string, callbacks?: {
        onSuccess?: (result: unknown) => void;
        onPending?: (result: unknown) => void;
        onError?: (result: unknown) => void;
        onClose?: () => void;
      }) => void;
    };
  }
}

const MONTH_OPTIONS = [1, 3, 6, 12];

export default function BillingPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Outlet selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Promo flow
  const [promoInput, setPromoInput] = useState("");
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [validatingPromo, setValidatingPromo] = useState(false);
  const [appliedPromo, setAppliedPromo] = useState<PromoPreview | null>(null);

  // Checkout
  const [months, setMonths] = useState(1);
  const [paying, setPaying] = useState(false);
  const [snapLoaded, setSnapLoaded] = useState(false);
  const closingRef = useRef(false);

  // History
  const [showHistory, setShowHistory] = useState(false);

  // Plan tier (Growth vs Pro). Defaults from current plan on load.
  const [planTier, setPlanTier] = useState<"GROWTH" | "PRO">("GROWTH");

  const { t } = useTranslation();

  // ── Fetch billing status ──
  const fetchStatus = useCallback(() => {
    setLoading(true);
    apiFetch<BillingStatus>("/api/billing/status")
      .then((res) => {
        const data = res.data;
        setStatus(data);
        // Default tier toggle from current plan
        setPlanTier(data.limits.planName === "Pro" ? "PRO" : "GROWTH");
        // Pre-select all locked and expiring outlets (they need renewal most)
        const autoSelect = new Set<string>();
        data.outlets.forEach((o) => {
          if (o.status === "LOCKED" || o.status === "EXPIRING") {
            autoSelect.add(o.id);
          }
        });
        setSelectedIds(autoSelect);
      })
      .catch((err) =>
        toast.error(
          err instanceof ApiClientError
            ? err.message
            : t("billing.toast.loadFail"),
        ),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // ponytail: promo preview is now tier-aware — /api/billing/promo/validate
  // accepts planTier, so no need to clear on switch. Manual tier changes clear
  // the promo in the button onClick (keeps the discount preview consistent).

  // ── Outlet selection ──
  function toggleOutlet(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllRenewable() {
    if (!status) return;
    // ponytail: "Pilih Semua" must select every outlet. The previous filter
    // (!o.isFreeTier) caused a visible bug where auto-selected free-tier
    // outlets (LOCKED/EXPIRING on load) got deselected when the user clicked
    // "Select All" — making it look like Select All was clearing the selection.
    setSelectedIds(new Set(status.outlets.map((o) => o.id)));
  }

  function deselectAll() {
    setSelectedIds(new Set());
  }

  // ── Validate promo ──
  async function handleApplyPromo() {
    const code = promoInput.trim();
    if (!code) {
      toast.error(t("billing.toast.promoEmpty"));
      return;
    }

    setValidatingPromo(true);
    setPromoPreview(null);

    try {
      const res = await apiFetch<PromoPreview>("/api/billing/promo/validate", {
        method: "POST",
        body: {
          code,
          branchIds: Array.from(selectedIds),
          months,
          planTier,
        },
      });
      const data = res.data;

      if (!data.valid) {
        setPromoPreview({ valid: false, error: data.error ?? t("billing.toast.promoInvalid") });
        setAppliedPromo(null);
        return;
      }

      setPromoPreview(data);
      setAppliedPromo(data);
      toast.success(t("billing.toast.promoApplied").replace("{code}", data.promoCode!.code));
    } catch (err) {
      const errMsg =
        err instanceof ApiClientError ? err.message : t("billing.toast.promoValidateFail");
      setPromoPreview({ valid: false, error: errMsg });
      setAppliedPromo(null);
    } finally {
      setValidatingPromo(false);
    }
  }

  function handleRemovePromo() {
    setPromoInput("");
    setPromoPreview(null);
    setAppliedPromo(null);
  }

  // ── Checkout ──
  async function handleCheckout() {
    if (!status || selectedIds.size === 0) return;

    setPaying(true);
    closingRef.current = false;

    try {
      const res = await apiFetch<{
        status: string;
        snapToken: string | null;
        redirectUrl?: string;
        message?: string;
      }>("/api/billing/checkout", {
        method: "POST",
        body: {
          branchIds: Array.from(selectedIds),
          months,
          promoCode: appliedPromo?.promoCode?.code ?? undefined,
          planTier,
        },
      });
      const data = res.data;

      if (data.status === "PAID") {
        toast.success(data.message ?? t("billing.toast.paid"));
        handleRemovePromo();
        fetchStatus();
        return;
      }

      if (data.snapToken && window.snap) {
        toast.info(t("billing.toast.openingSnap"));
        window.snap.pay(data.snapToken, {
          onSuccess: () => {
            toast.success(t("billing.toast.paid"));
            handleRemovePromo();
            fetchStatus();
          },
          onPending: () => {
            toast.info(t("billing.toast.pending"));
            fetchStatus();
          },
          onError: () => {
            toast.error(t("billing.toast.failed"));
            fetchStatus();
          },
          onClose: () => {
            if (!closingRef.current) {
              closingRef.current = true;
              toast.info(t("billing.toast.closed"));
              fetchStatus();
            }
          },
        });
        return;
      }

      toast.info(t("billing.toast.preparing"));
    } catch (err) {
      toast.error(
        err instanceof ApiClientError
          ? err.message
          : t("billing.toast.checkoutFail"),
      );
    } finally {
      setPaying(false);
    }
  }

  // ── Derived values ──
  const isPaid = status?.limits.isPaid ?? false;
  // Downgrade guard: a Pro tenant can only extend/upgrade — lock out Growth.
  const isProTenant = status?.limits.planName === "Pro";
  // ponytail: server returns Growth pricing (49K/79K) regardless of tier.
  // Override on the client based on toggle so totals recompute correctly.
  const unitPrice = planTier === "PRO" ? 79000 : (status?.pricing.unitPrice ?? 49000);
  const originalUnitPrice = status?.pricing.originalUnitPrice ?? 79000;
  const showStrikeThrough = planTier === "GROWTH";
  const selectedCount = selectedIds.size;
  const renewableOutlets = status?.outlets.filter((o) => !o.isFreeTier) ?? [];

  // Bill calculation
  const grossTotal = unitPrice * selectedCount * months;
  let discount = 0;
  let freeMonths = 0;

  if (appliedPromo?.calculation && appliedPromo.calculation.outletCount > 0) {
    if (appliedPromo.calculation.freeMonths > 0) {
      freeMonths = appliedPromo.calculation.freeMonths;
      const monthsToCharge = Math.max(0, months - freeMonths);
      discount = grossTotal - unitPrice * selectedCount * monthsToCharge;
    } else if (appliedPromo.calculation.grossTotal > 0) {
      // Scale discount proportionally — guard against div-by-zero if outletCount or months is 0
      const scaleBase =
        appliedPromo.calculation.outletCount * appliedPromo.calculation.months;
      if (scaleBase > 0) {
        discount = Math.round(
          (appliedPromo.calculation.discount * selectedCount * months) / scaleBase,
        );
      }
    }
  }

  const total = Math.max(0, grossTotal - discount);
  const isFreeCheckout = total <= 0;
  const canPay = selectedCount > 0 && !paying;

  // ── Loading skeleton ──
  if (loading || !status) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("billing.title")} description={t("billing.subtitleLoading")} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Script
        src={
          process.env.NEXT_PUBLIC_MIDTRANS_ENV === "production"
            ? "https://app.midtrans.com/snap/snap.js"
            : "https://app.sandbox.midtrans.com/snap/snap.js"
        }
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY ?? ""}
        onLoad={() => setSnapLoaded(true)}
      />

      <PageHeader title={t("billing.title")} description={t("billing.subtitle")} />

      {/* ── Referral: invite other laundry owners, earn a free month ── */}
      <ReferralCard />

      {/* ── Status Card ── */}
      <CardListItem>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-primary" />
            {t("billing.status.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Plan */}
            <FormField label={t("billing.status.plan")}>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">{status.limits.planName}</span>
                <Badge variant={isPaid ? "default" : "secondary"}>
                  {isPaid ? t("billing.status.paid") : t("billing.status.free")}
                </Badge>
              </div>
            </FormField>

            {/* Active Outlets */}
            <FormField label={t("billing.status.activeOutlets")}>
              <div className="text-lg font-bold">
                {status.activeCount}
                <span className="text-sm text-muted-foreground">{t("billing.status.activeOutletsUnit")}</span>
              </div>
            </FormField>

            {/* Locked Outlets */}
            <FormField label={t("billing.status.lockedOutlets")}>
              <div className="text-lg font-bold">
                {status.lockedCount}
                <span className="text-sm text-muted-foreground">{t("billing.status.activeOutletsUnit")}</span>
              </div>
            </FormField>

            {/* Latest Expiry — fall back to trialEndsAt so trial users see when their trial ends */}
            <FormField label={t("billing.status.latestExpiry")}>
              <div className="text-lg font-bold">
                {(status.subscription?.currentPeriodEnd ?? status.trialEndsAt)
                  ? formatDate(status.subscription?.currentPeriodEnd ?? status.trialEndsAt!)
                  : "—"}
              </div>
            </FormField>
          </div>

          {/* Free tier limits notice */}
          {!isPaid && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">{t("billing.status.freeTierLabel")}</span>{" "}
                  {t("billing.status.freeTierNotice")
                    .replace("{users}", String(status.limits.maxUsers))
                    .replace("{orders}", String(status.limits.maxOrders))}
                </div>
              </div>
            </div>
          )}

          {/* Paid benefits */}
          {isPaid && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div className="text-sm text-green-800 dark:text-green-200">
                  <span className="font-semibold">{t("billing.status.growthActive")}</span>
                  {t("billing.status.growthActiveDesc").replace("{outlets}", String(status.activeCount))}
                </div>
              </div>
            </div>
          )}

          {/* Pro upsell — only for non-Pro users (Free or Growth) */}
          {status.limits.planName !== "Pro" && (
            <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/30">
              <div className="flex items-start gap-3">
                <Globe className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-sky-900 dark:text-sky-100">
                      {t("billing.status.upgradePro")}
                    </span>
                    <Badge variant="secondary" className="text-[10px]">{t("billing.badge.website")}</Badge>
                  </div>
                  <p className="mb-2 text-sm text-sky-800 dark:text-sky-200">
                    {t("billing.status.upgradeProDesc")}
                    <code className="rounded bg-sky-100 px-1 py-0.5 font-mono text-xs dark:bg-sky-900/50">
                      slug.hivepos.id
                    </code>
                    {t("billing.status.upgradeProDescSuffix")}
                  </p>
                  <ul className="mb-3 grid grid-cols-1 gap-y-1 gap-x-3 text-xs text-sky-700 dark:text-sky-300 sm:grid-cols-2">
                    <li>✓ {t("billing.status.upgradeProFeat1")}</li>
                    <li>✓ {t("billing.status.upgradeProFeat2")}</li>
                    <li>✓ {t("billing.status.upgradeProFeat3")}</li>
                    <li>✓ {t("billing.status.upgradeProFeat4")}</li>
                    <li>✓ {t("billing.status.upgradeProFeat5")}</li>
                  </ul>
                  <Link
                    href="/website"
                    className={cn(buttonVariants({ size: "sm" }))}
                  >
                    <Sparkles className="mr-1 h-3.5 w-3.5" />
                    {t("billing.status.upgradeProCta")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Expiring soon warning */}
          {status.expiringSoon.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <span className="font-semibold">{t("billing.status.expiringSoon").replace("{count}", String(status.expiringSoon.length))}</span>{" "}
                  {status.expiringSoon.map((o) => o.name).join(", ")}
                  {t("billing.status.expiringSoonSuffix")}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </CardListItem>

      {/* ── Outlet & Renewal Card ── */}
      <CardListItem>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-base">
            <Building2 className="h-4 w-4 text-primary" />
            {t("billing.outlet.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Plan tier selector — Growth (49K) vs Pro (79K + website) */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              {t("billing.outlet.selectPlan")}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isProTenant}
                onClick={() => {
                  if (isProTenant) return;
                  handleRemovePromo();
                  setPlanTier("GROWTH");
                }}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition-all",
                  isProTenant && "cursor-not-allowed opacity-50",
                  planTier === "GROWTH"
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/40 bg-background hover:bg-muted/50",
                )}
              >
                <div className="text-sm font-bold">{t("billing.outlet.planGrowth")}</div>
                <div className={cn(
                  "text-xs",
                  planTier === "GROWTH" ? "text-primary-foreground/80" : "text-muted-foreground",
                )}>
                  {t("billing.outlet.planGrowthPrice")}
                </div>
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRemovePromo();
                  setPlanTier("PRO");
                }}
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition-all",
                  planTier === "PRO"
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border/40 bg-background hover:bg-muted/50",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold">{t("billing.outlet.planPro")}</span>
                  <Badge
                    variant={planTier === "PRO" ? "secondary" : "outline"}
                    className="text-[10px]"
                  >
                    {t("billing.badge.website")}
                  </Badge>
                </div>
                <div className={cn(
                  "text-xs",
                  planTier === "PRO" ? "text-primary-foreground/80" : "text-muted-foreground",
                )}>
                  {t("billing.outlet.planProPrice")}
                </div>
              </button>
            </div>
            {planTier === "PRO" && (
              <p className="text-xs text-muted-foreground">
                {t("billing.outlet.planProIncludes")}
                <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
                  slug.hivepos.id
                </code>
                {t("billing.outlet.planProIncludesSuffix")}
              </p>
            )}
          </div>

          {/* Price per outlet */}
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="text-3xl font-black tabular-nums">{formatCurrency(unitPrice)}</span>
            {showStrikeThrough && (
              <>
                <span className="text-lg text-muted-foreground line-through tabular-nums">
                  {formatCurrency(originalUnitPrice)}
                </span>
              </>
            )}
            <span className="text-sm text-muted-foreground">{t("billing.outlet.perOutletMonth")}</span>
          </div>

          {/* Outlet list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {t("billing.outlet.selectToRenew")}
              </Label>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={selectAllRenewable}
                >
                  {t("billing.outlet.selectAll")}
                </Button>
                {selectedCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={deselectAll}
                  >
                    {t("billing.outlet.cancel")}
                  </Button>
                )}
              </div>
            </div>

            {status.outlets.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm rounded-lg border border-dashed border-border/40">
                {t("billing.outlet.empty")}
              </div>
            ) : (
              <div className="space-y-2">
                {status.outlets.map((outlet) => (
                  <OutletRow
                    key={outlet.id}
                    outlet={outlet}
                    selected={selectedIds.has(outlet.id)}
                    onToggle={() => toggleOutlet(outlet.id)}
                  />
                ))}
              </div>
            )}

            {selectedCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {t("billing.outlet.selectedCount").replace("{count}", String(selectedCount))}
              </p>
            )}
          </div>

          {/* Duration selector */}
          {selectedCount > 0 && (
            <>
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("billing.duration.title")}
                </Label>
                <div className="flex flex-wrap gap-2">
                  {MONTH_OPTIONS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonths(m)}
                      className={cn(
                        "rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                        months === m
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-border/40 bg-background hover:bg-muted/50",
                      )}
                    >
                      {t("billing.duration.months").replace("{m}", String(m))}
                    </button>
                  ))}
                </div>
              </div>

              {/* Promo code input */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  {t("billing.promo.title")}
                </Label>
                {appliedPromo ? (
                  <div className="flex items-center justify-between rounded-lg border border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30 p-3">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <div>
                        <span className="font-semibold text-sm">{appliedPromo.promoCode?.code}</span>
                        {appliedPromo.promoCode?.description && (
                          <span className="text-xs text-muted-foreground ml-2">
                            — {appliedPromo.promoCode.description}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={handleRemovePromo}>
                      {t("billing.promo.remove")}
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={promoInput}
                        onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                        placeholder={t("billing.promo.placeholder")}
                        className="pl-9"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleApplyPromo();
                          }
                        }}
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={handleApplyPromo}
                      disabled={validatingPromo || !promoInput.trim()}
                    >
                      {validatingPromo ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Gift className="mr-2 h-4 w-4" />
                      )}
                      {t("billing.promo.apply")}
                    </Button>
                  </div>
                )}
                {promoPreview && !promoPreview.valid && (
                  <p className="text-xs text-destructive">{promoPreview.error}</p>
                )}
              </div>

              {/* Bill Summary */}
              <div className="rounded-lg border border-border/40 bg-muted/20 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {t("billing.summary.perLine")
                      .replace("{price}", formatCurrency(unitPrice))
                      .replace("{outlets}", String(selectedCount))
                      .replace("{months}", String(months))}
                  </span>
                  <span className="font-medium tabular-nums">{formatCurrency(grossTotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t("billing.summary.promoDiscount")}</span>
                    <span className="font-medium tabular-nums">-{formatCurrency(discount)}</span>
                  </div>
                )}
                {freeMonths > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>{t("billing.summary.freeMonths")}</span>
                    <span className="font-medium">{t("billing.summary.freeMonthsValue").replace("{months}", String(freeMonths))}</span>
                  </div>
                )}
                <div className="border-t border-border/30 pt-2 flex justify-between">
                  <span className="font-bold">{t("billing.summary.total")}</span>
                  <span className="text-xl font-black tabular-nums">{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Checkout button */}
              <Button
                onClick={handleCheckout}
                disabled={!canPay}
                className="w-full bg-gradient-to-r from-brand-600 to-brand-700 shadow-md shadow-brand-600/15 transition-all hover:shadow-lg hover:brightness-105"
                size="lg"
              >
                {paying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("billing.checkout.processing")}
                  </>
                ) : isFreeCheckout ? (
                  <>
                    <Gift className="mr-2 h-4 w-4" />
                    {freeMonths > 0
                      ? t("billing.checkout.claimFreeMonths").replace("{months}", String(freeMonths + months))
                      : t("billing.checkout.claimFree")}
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 h-4 w-4" />
                    {t("billing.checkout.pay").replace("{amount}", formatCurrency(total))}
                  </>
                )}
              </Button>

              {!snapLoaded && !isFreeCheckout && (
                <p className="text-center text-xs text-muted-foreground">
                  {t("billing.checkout.loadingSnap")}
                </p>
              )}
            </>
          )}

          {selectedCount === 0 && renewableOutlets.length > 0 && (
            <div className="text-center py-6 text-muted-foreground text-sm rounded-lg border border-dashed border-border/40">
              {t("billing.outlet.noneSelectedHint")}
            </div>
          )}
        </CardContent>
      </CardListItem>

      {/* ── Payment History (collapsible) ── */}
      <div className="rounded-xl border border-border/40 bg-card shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setShowHistory((s) => !s)}
          aria-expanded={showHistory}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-muted/30 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <History className="h-4 w-4 text-primary" />
            {t("billing.history.title")}
            {status.payments.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {status.payments.length}
              </Badge>
            )}
          </span>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              showHistory && "rotate-180",
            )}
          />
        </button>
        {showHistory && (
          <div className="px-4 pb-4 pt-2 space-y-2 border-t border-border/30">
            {status.payments.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                {t("billing.history.empty")}
              </div>
            ) : (
              <div className="space-y-2">
                {status.payments.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-border/30 bg-background p-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <div className="font-medium text-sm">
                          {t("billing.history.line")
                            .replace("{months}", String(p.monthsPurchased))
                            .replace("{outlets}", String(p.outletCount))}
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3 w-3" />
                          {formatDate(p.createdAt)}
                          {p.midtransOrderId && (
                            <span className="font-mono">· {p.midtransOrderId.slice(-12)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-sm tabular-nums">{formatCurrency(p.amount)}</span>
                      <Badge
                        variant={
                          p.status === "PAID"
                            ? "default"
                            : p.status === "FAILED"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {p.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Outlet Row Component ──

function OutletRow({
  outlet,
  selected,
  onToggle,
}: {
  outlet: Outlet;
  selected: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const isFreeTier = outlet.isFreeTier;

  const statusConfig: Record<
    Outlet["status"],
    { label: string; className: string; icon: typeof Lock }
  > = {
    FREE: {
      label: t("billing.outlet.statusFree"),
      className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-900",
      icon: Sparkles,
    },
    ACTIVE: {
      label: t("billing.outlet.statusActive"),
      className: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 border-green-200 dark:border-green-900",
      icon: CheckCircle2,
    },
    EXPIRING: {
      label: t("billing.outlet.statusExpiring"),
      className: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-900",
      icon: AlertTriangle,
    },
    LOCKED: {
      label: t("billing.outlet.statusLocked"),
      className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 border-red-200 dark:border-red-900",
      icon: Lock,
    },
  };

  const config = statusConfig[outlet.status];
  const StatusIcon = config.icon;

  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-all cursor-pointer",
        selected
          ? "border-primary bg-primary/5 shadow-sm"
          : "border-border/40 bg-background hover:bg-muted/30",
      )}
    >
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-5 w-5 rounded border-border accent-primary cursor-pointer"
      />

      {/* Outlet info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm truncate">{outlet.name}</span>
          <Badge variant="outline" className={cn("text-xs", config.className)}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {isFreeTier ? (
            t("billing.outlet.freeTierHint")
          ) : outlet.coverageEnd ? (
            <>
              {t("billing.outlet.until")} {formatDate(outlet.coverageEnd)}
              {outlet.expiresInDays !== null && (
                <span className="ml-1">
                  ({outlet.expiresInDays > 0
                    ? t("billing.outlet.daysLeft").replace("{days}", String(outlet.expiresInDays))
                    : t("billing.outlet.expired")})
                </span>
              )}
            </>
          ) : (
            t("billing.outlet.notActive")
          )}
        </div>
      </div>

      {/* Store icon */}
      <Store className="h-5 w-5 text-muted-foreground shrink-0" />
    </label>
  );
}
