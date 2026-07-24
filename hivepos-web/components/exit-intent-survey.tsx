"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { apiFetch } from "@/lib/api/client";

/**
 * One-question exit-intent survey — the CRO research instrument
 * (docs/WEBSITE.md → "CRO Audit"). Captures WHY visitors leave, in Big-5
 * objection buckets so GA4 can aggregate the distribution. Free-text + email
 * responses persist via the anonymous /public/tickets endpoint (no backend
 * change); anonymous answers rely on GA4 alone.
 *
 * ponytail: copy is hardcoded Bahasa Indonesia, matching lib/landing-data-saas.ts
 * (the marketing surface this lives on isn't wired through t()). Migrate to
 * lib/i18n.ts if an en marketing variant ever ships.
 */
const QUESTION = "Sebentar — apa yang menahan Anda dari daftar hari ini?";
const SUBHEAD = "Cuma 1 klik. Bantu kami bikin hivePOS lebih pas buat Anda.";
const DONE_MSG = "Terima kasih atas masukan Anda.";

type Bucket = "fit" | "effort" | "price" | "timing" | "other";

const OPTIONS: { value: Bucket; label: string }[] = [
  { value: "fit", label: "Masih ragu cocok untuk laundry saya" },
  { value: "effort", label: "Khawatir ribet / susah dipakai" },
  { value: "price", label: "Ragu soal harga / takut biaya tersembunyi" },
  { value: "timing", label: "Lagi lihat-lihat / belum siap" },
  { value: "other", label: "Lainnya…" },
];

const MARKETING_PREFIXES = ["/alternatif", "/blog", "/demo"];
const STORAGE_KEY = "hivepos_exit_survey";
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000; // 14 days
const MIN_TIME_MS = 3_000; // ignore exit-intent in the first 3s on page
const MOBILE_DELAY_MS = 25_000; // touch has no exit-intent → time-on-page fallback

type Stored = { dismissedAt?: number; submitted?: boolean };

function isMarketing(pathname: string | null): boolean {
  if (!pathname) return false;
  return pathname === "/" || MARKETING_PREFIXES.some((p) => pathname.startsWith(p));
}

function readStore(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Stored) : {};
  } catch {
    return {};
  }
}

function writeStore(next: Stored): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* private mode / disabled — survey just won't suppress; acceptable */
  }
}

function suppressed(): boolean {
  const s = readStore();
  if (s.submitted) return true;
  return !!s.dismissedAt && Date.now() - s.dismissedAt < COOLDOWN_MS;
}

export function ExitIntentSurvey() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const [bucket, setBucket] = useState<Bucket | null>(null);
  const [detail, setDetail] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submittedRef = useRef(false);

  // Arm the trigger on a marketing route, respecting cooldown/submit state.
  useEffect(() => {
    if (!isMarketing(pathname) || suppressed()) return;

    const armedAt = Date.now();
    let fired = false;
    const fire = () => {
      if (fired || open) return;
      if (Date.now() - armedAt < MIN_TIME_MS) return;
      fired = true;
      setOpen(true);
      track("exit_survey_seen");
    };

    // Desktop: cursor leaves the top of the viewport.
    const onMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0) fire();
    };
    document.addEventListener("mouseleave", onMouseLeave);

    // Touch devices have no exit-intent → time-on-page fallback.
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (window.matchMedia("(pointer: coarse)").matches) {
      timer = setTimeout(fire, MOBILE_DELAY_MS);
    }

    return () => {
      document.removeEventListener("mouseleave", onMouseLeave);
      if (timer) clearTimeout(timer);
    };
  }, [pathname, open]);

  // Auto-close shortly after the thank-you state.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setOpen(false), 1800);
    return () => clearTimeout(t);
  }, [done]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    // A close without a submit = dismissal → cooldown + track.
    if (!next && !submittedRef.current) {
      writeStore({ ...readStore(), dismissedAt: Date.now() });
      track("exit_survey_dismissed");
    }
  }

  async function handleSubmit() {
    if (!bucket || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);

    const label = labelFor(bucket);
    const message = detail.trim() ? `${label}: ${detail.trim()}` : label;

    track("exit_survey_submitted", {
      objection_bucket: bucket,
      has_detail: detail.trim().length > 0,
      has_email: email.trim().length > 0,
      // ponytail: GA4 caps event params ~100 chars; short objections fit, long
      // "lainnya" notes truncate. Full free-text persists only with an email.
      detail: detail.trim().slice(0, 90),
    });

    // /public/tickets requires name+email+message → only persists when an email
    // is left (also a lead CS can follow up). Anonymous answers rely on GA4.
    if (email.trim()) {
      try {
        await apiFetch<{ ticketId: string }>("/api/public/tickets", {
          method: "POST",
          body: {
            name: "Exit Survey",
            email: email.trim(),
            subject: "Exit Survey",
            message,
          },
        });
      } catch {
        /* best-effort storage; the GA4 signal already fired */
      }
    }

    writeStore({ ...readStore(), submitted: true });
    setSubmitting(false);
    setDone(true);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        {done ? (
          <div className="py-6 text-center">
            <DialogTitle className="text-base font-semibold">{DONE_MSG}</DialogTitle>
            <DialogDescription className="mt-1">
              Sampai jumpa di hivePOS.
            </DialogDescription>
          </div>
        ) : (
          <>
            <div>
              <DialogTitle className="text-base font-semibold">{QUESTION}</DialogTitle>
              <DialogDescription className="mt-1">{SUBHEAD}</DialogDescription>
            </div>

            <div className="flex flex-col gap-1.5">
              {OPTIONS.map((o) => (
                <label
                  key={o.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm transition-colors has-[:checked]:border-sky-400 has-[:checked]:bg-sky-50 dark:has-[:checked]:border-sky-500 dark:has-[:checked]:bg-sky-950/30"
                >
                  <input
                    type="radio"
                    name="exit-survey-objection"
                    value={o.value}
                    checked={bucket === o.value}
                    onChange={() => setBucket(o.value)}
                    className="size-4 accent-sky-500"
                  />
                  <span>{o.label}</span>
                </label>
              ))}
            </div>

            {bucket === "other" && (
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                placeholder="Cerita singkat kenapa ragu…"
                rows={2}
                maxLength={300}
                className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            )}

            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                Mau dibantu langsung? <span className="text-xs">(opsional)</span>
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="anda@email.com"
                className="rounded-lg border border-border bg-background p-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>

            <DialogFooter>
              <Button
                onClick={handleSubmit}
                disabled={!bucket}
                loading={submitting}
                className="w-full sm:w-auto"
              >
                Kirim
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function labelFor(bucket: Bucket): string {
  return OPTIONS.find((o) => o.value === bucket)?.label ?? bucket;
}
