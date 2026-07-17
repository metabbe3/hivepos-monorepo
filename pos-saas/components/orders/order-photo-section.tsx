"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Camera, Loader2, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { toast } from "sonner";
import {
  ProofPhotosView,
  type ProofPhoto,
  type ProofLabels,
} from "@/components/photos/proof-photos-view";

type PhotoKind = "before" | "after" | "damage";

interface Photo extends ProofPhoto {
  width: number | null;
  height: number | null;
  mime: string;
  expiresAt: string;
}

interface Props {
  orderId: string;
}

// Per-kind accent so the three capture actions are glanceable: before = neutral,
// after = emerald (the "clean" payoff), damage = amber (caution).
const KINDS: { kind: PhotoKind; addKey: string; accent: string }[] = [
  {
    kind: "before",
    addKey: "photos.addBefore",
    accent:
      "border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
  },
  {
    kind: "after",
    addKey: "photos.addAfter",
    accent:
      "border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950",
  },
  {
    kind: "damage",
    addKey: "photos.addDamage",
    accent:
      "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:hover:bg-amber-950",
  },
];

// "Foto bukti cucian" — Pro-only before/after/damage proof photos. Served
// through the auth-gated /api route (cookies same-origin), so a plain image
// element works and next/image isn't needed.
export function OrderPhotoSection({ orderId }: Props) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [gate, setGate] = useState<{ enabled: boolean; plan: string } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const labels: ProofLabels = {
    before: t("photos.before"),
    after: t("photos.after"),
    damage: t("photos.damage"),
    compare: t("photos.compare"),
    compareHint: t("photos.compareHint"),
    next: t("photos.next"),
    prev: t("photos.prev"),
    close: t("photos.close"),
    delete: t("photos.delete"),
    deletedTile: t("photos.deletedTile"),
  };

  useEffect(() => {
    let alive = true;
    apiFetch<{ photos: Photo[]; enabled: boolean; plan: string }>(
      `/api/orders/${orderId}/photos`,
    )
      .then(({ data }) => {
        if (!alive) return;
        setPhotos(data.photos);
        setGate({ enabled: data.enabled, plan: data.plan });
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [orderId]);

  async function upload(kind: PhotoKind, file: File) {
    setUploadingKind(kind);
    try {
      // Raw fetch — apiFetch would JSON-stringify the FormData body.
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const res = await fetch(`/api/orders/${orderId}/photos`, {
        method: "POST",
        body: form,
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.data) {
        const msg = json?.error?.message ?? "Upload failed";
        throw new ApiClientError("UPLOAD_FAILED", msg, res.status);
      }
      setPhotos((prev) => [...prev, json.data as Photo]);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Upload failed");
    } finally {
      setUploadingKind(null);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({ title: t("photos.deleteConfirm") });
    if (!ok) return;
    try {
      await apiFetch(`/api/orders/${orderId}/photos/${id}`, {
        method: "DELETE",
      });
      setPhotos((prev) => prev.filter((p) => p.id !== id));
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Delete failed");
    }
  }

  if (loading) return null;

  // Non-Pro → upgrade nudge (don't hide the opportunity to convert).
  if (gate && !gate.enabled && gate.plan !== "PRO") {
    return (
      <Card className="rounded-xl border-amber-200 bg-amber-50 shadow-sm dark:border-amber-900 dark:bg-amber-950/30">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Camera className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100">
                  {t("photos.upgradeTitle")}
                </h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                  <Sparkles className="h-3 w-3" />
                  {t("photos.pro")}
                </span>
              </div>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                {t("photos.upgradeBody")}
              </p>
              <Link
                href="/billing"
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700"
              >
                {t("photos.upgradeCta")}
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Flag disabled (super-admin kill-switch) or unknown gate → hide.
  if (gate && !gate.enabled) return null;

  return (
    <Card className="rounded-xl border-border/60 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base font-bold">
            {t("photos.title")}
          </CardTitle>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
            <Sparkles className="h-3 w-3" />
            {t("photos.pro")}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{t("photos.expiryNote")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Capture bar */}
        <div className="flex flex-wrap gap-2">
          {KINDS.map(({ kind, addKey, accent }) => (
            <button
              key={kind}
              type="button"
              disabled={uploadingKind !== null}
              onClick={() => inputs.current[kind]?.click()}
              className={`inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 ${accent}`}
            >
              {uploadingKind === kind ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Camera className="h-3.5 w-3.5" />
              )}
              {t(addKey)}
              <input
                ref={(el) => {
                  inputs.current[kind] = el;
                }}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) upload(kind, f);
                  e.target.value = "";
                }}
              />
            </button>
          ))}
        </div>

        {photos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 bg-muted/30 p-6 text-center">
            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-background text-muted-foreground shadow-sm">
              <Camera className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium">{t("photos.empty")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t("photos.emptyHint")}
            </p>
          </div>
        ) : (
          <ProofPhotosView
            photos={photos}
            baseUrl={`/api/orders/${orderId}/photos`}
            labels={labels}
            onDelete={remove}
          />
        )}
      </CardContent>
    </Card>
  );
}
