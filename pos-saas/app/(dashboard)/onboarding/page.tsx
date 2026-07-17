"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Tag, Store, Users, ShoppingBag, ArrowRight, Check, Sparkles, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { toast } from "sonner";

type Status = {
  servicesExist: boolean;
  outletConfigured: boolean;
  customersExist: boolean;
  firstOrderPlaced: boolean;
  done: number;
  total: number;
  percent: number;
};

const STEPS: { icon: LucideIcon; titleKey: string; descKey: string; href: string; doneKey: keyof Status }[] = [
  { icon: Tag, titleKey: "onboarding.stepServices", descKey: "onboarding.stepServicesDesc", href: "/services", doneKey: "servicesExist" },
  { icon: Store, titleKey: "onboarding.stepOutlet", descKey: "onboarding.stepOutletDesc", href: "/branches", doneKey: "outletConfigured" },
  { icon: Users, titleKey: "onboarding.stepCustomers", descKey: "onboarding.stepCustomersDesc", href: "/customers", doneKey: "customersExist" },
  { icon: ShoppingBag, titleKey: "onboarding.stepFirstOrder", descKey: "onboarding.stepFirstOrderDesc", href: "/laundry/orders/new", doneKey: "firstOrderPlaced" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { update } = useSession();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    apiFetch<Status>("/api/onboarding/status")
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null));
  }, []);

  async function finish() {
    setBusy(true);
    try {
      await apiFetch("/api/tenant/onboarding", { method: "PATCH" });
      await update({ refreshOnboarding: true } as any);
      router.replace("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : t("onboarding.failed"));
      setBusy(false);
    }
  }

  const percent = status?.percent ?? 0;
  const allDone = status?.done === status?.total;

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{t("onboarding.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("onboarding.subtitle")}</p>
      </div>

      {/* Progress bar */}
      {status ? (
        <div className="rounded-xl bg-muted/40 p-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold">
              {allDone ? "✓ " : ""}{percent}% complete
            </span>
            <span className="text-muted-foreground sa-tnum">{status.done} of {status.total} done</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-500 ${allDone ? "bg-emerald-500" : "bg-primary"}`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      ) : null}

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const done = status ? !!status[step.doneKey] : false;
          return (
            <Link
              key={step.href}
              href={step.href}
              className={`flex items-center gap-4 rounded-xl border p-4 transition-all hover:shadow-sm ${
                done
                  ? "border-emerald-200 bg-emerald-50/40 dark:bg-emerald-950/10"
                  : "border-border/60 bg-card hover:border-border"
              }`}
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                done ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {done ? <Check className="h-5 w-5" /> : <step.icon className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`font-medium ${done ? "text-emerald-700 dark:text-emerald-400" : ""}`}>
                  <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                  {t(step.titleKey)}
                </p>
                <p className="text-sm text-muted-foreground">{t(step.descKey)}</p>
              </div>
              {done ? null : <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
            </Link>
          );
        })}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={finish} disabled={busy}>
          {t("onboarding.skip")}
        </Button>
        <Button
          onClick={finish}
          disabled={busy}
          variant={allDone ? "default" : "outline"}
          className={allDone ? "" : "border-2"}
        >
          {busy ? "..." : allDone ? "✓ " + t("onboarding.done") : t("onboarding.done")}
        </Button>
      </div>
    </div>
  );
}
