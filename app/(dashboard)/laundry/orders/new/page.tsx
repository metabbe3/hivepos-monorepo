"use client";

import { useEffect } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  CheckCircle2,
  Receipt,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageLoading } from "@/components/shared/loading";
import { useTranslation } from "@/hooks/use-translation";
import { useFeatureFlag } from "@/hooks/use-feature-flag";
import { formatCurrency } from "@/lib/format";
import { OrderPhotoSection } from "@/components/orders/order-photo-section";
import { NewOrderProvider, useNewOrder } from "./new-order-context";
import { CustomerPicker } from "./customer-picker";
import { ServicePicker } from "./service-picker";
import { CartSection } from "./cart-section";

// ponytail: page is a thin shell over NewOrderProvider. State, handlers,
// effects (draft autosave, offline submit, cache warming) live in the provider.
// Section components consume via useNewOrder().

export default function NewOrderPage() {
  return (
    <NewOrderProvider>
      <NewOrderLayout />
    </NewOrderProvider>
  );
}

/** Format a Date as a `datetime-local` value in the user's local timezone. */
function toLocalInput(d: Date): string {
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60000);
  return local.toISOString().slice(0, 16);
}

function NewOrderLayout() {
  const router = useRouter();
  const { t, lang } = useTranslation();
  const {
    loading,
    useCustomTime,
    setUseCustomTime,
    customDateTime,
    setCustomDateTime,
    handleSubmit,
    createdOrder,
    showDraftDialog,
    resumeDraft,
    discardDraft,
  } = useNewOrder();

  if (loading) return <PageLoading />;
  if (createdOrder) {
    return (
      <SuccessScreen orderId={createdOrder.id} orderNumber={createdOrder.orderNumber} />
    );
  }

  // Effective time shown to the kasir (now, or the chosen custom time).
  const effective =
    !useCustomTime || !customDateTime ? new Date() : new Date(customDateTime);
  const effectiveLabel = effective.toLocaleString(lang === "id" ? "id-ID" : "en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  function enableCustomTime() {
    setUseCustomTime(true);
    if (!customDateTime) setCustomDateTime(toLocalInput(new Date()));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 animate-fade-in-up">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-lg hover:bg-muted"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <nav className="flex items-center gap-1 text-xs text-muted-foreground">
            <Link href="/laundry/orders" className="transition-colors hover:text-foreground">
              {t("orders.title")}
            </Link>
            <ChevronRight className="h-3 w-3" />
          </nav>
          <h1 className="text-2xl font-bold tracking-tight">{t("newOrder.title")}</h1>
        </div>
      </div>

      {/* Waktu Order — preset-driven, calm */}
      <div className="rounded-xl border border-border/40 bg-card p-3 shadow-sm animate-fade-in-up sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-1 inline-flex items-center gap-1.5 text-sm font-medium">
            <Clock className="h-4 w-4 text-muted-foreground" />
            {t("newOrder.timeLabel")}
          </span>
          {/* primary toggle: now vs custom */}
          <button
            type="button"
            onClick={() => {
              setUseCustomTime(false);
              setCustomDateTime("");
            }}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              !useCustomTime
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/40 text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {t("newOrder.timeNow")}
          </button>
          <button
            type="button"
            onClick={enableCustomTime}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              useCustomTime
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-border/40 text-muted-foreground hover:bg-muted/60"
            }`}
          >
            {t("newOrder.timeCustom")}
          </button>

          {useCustomTime && (
            <>
              <Input
                type="datetime-local"
                value={customDateTime}
                onChange={(e) => setCustomDateTime(e.target.value)}
                className="h-9 w-full text-sm sm:w-auto sm:min-w-[220px]"
              />
              {/* quick chips */}
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setHours(9, 0, 0, 0);
                  setCustomDateTime(toLocalInput(d));
                }}
                className="rounded-lg border border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
              >
                {t("newOrder.timeMorning")}
              </button>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  d.setDate(d.getDate() - 1);
                  d.setHours(12, 0, 0, 0);
                  setCustomDateTime(toLocalInput(d));
                }}
                className="rounded-lg border border-border/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/60"
              >
                {t("newOrder.timeYesterday")}
              </button>
            </>
          )}

          <span className="ml-auto text-xs font-medium text-muted-foreground">
            {effectiveLabel}
          </span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <CustomerPicker />
        <ServicePicker />
        <CartSection />
      </form>

      {/* Draft recovery dialog */}
      <Dialog
        open={showDraftDialog}
        onOpenChange={(open) => {
          if (!open) discardDraft();
        }}
      >
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              {t("newOrder.draftFound")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              onClick={discardDraft}
              variant="outline"
              className="flex-1 rounded-xl"
            >
              {t("newOrder.draftDiscard")}
            </Button>
            <Button
              onClick={resumeDraft}
              className="flex-1 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 font-semibold text-white"
            >
              {t("newOrder.draftResume")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Post-create success screen — order confirmation + embedded Pro photo capture. */
function SuccessScreen({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const { total, resetForNewOrder } = useNewOrder();
  const orderFlowV2 = useFeatureFlag("orderFlowV2");

  // orderFlowV2: press "n" to start the next order without leaving the keyboard.
  useEffect(() => {
    if (!orderFlowV2) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable) return;
      resetForNewOrder();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [orderFlowV2, resetForNewOrder]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {/* Confirmation */}
      <div className="animate-in fade-in-0 zoom-in-95 rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-6 text-center shadow-sm duration-300 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-gray-900">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/50 dark:text-emerald-400">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h2 className="text-xl font-bold">{t("newOrder.successTitle")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("newOrder.successBody")}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-border/60 bg-card px-4 py-2">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-semibold">{orderNumber}</span>
          <span className="mx-2 h-4 w-px bg-border" />
          <span className="font-bold">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Pro photo capture — self-gates via GET /api/orders/[id]/photos {enabled,plan}.
          Pro: capture buttons + gallery. Non-Pro: amber upgrade nudge. */}
      <div className="animate-fade-in-up">
        <div className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          {t("newOrder.captureBefore")}
        </div>
        <OrderPhotoSection orderId={orderId} />
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          onClick={() => resetForNewOrder()}
          className="flex-1 bg-gradient-to-r from-brand-600 to-brand-700 font-semibold text-white shadow-md shadow-brand-600/15 transition-all hover:brightness-105"
        >
          {t("newOrder.newAgain")}
          {orderFlowV2 && (
            <kbd className="ml-2 rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-mono leading-none">N</kbd>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/laundry/orders/${orderId}`)}
          className="flex-1"
        >
          {t("newOrder.viewDetail")}
        </Button>
      </div>
    </div>
  );
}
