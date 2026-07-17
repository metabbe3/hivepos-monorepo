"use client";

import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { useTranslation } from "@/hooks/use-translation";
import {
  ProofPhotosView,
  type ProofPhoto,
  type ProofLabels,
} from "@/components/photos/proof-photos-view";

interface Props {
  orderNumber: string;
}

/**
 * Customer-facing proof-photo block on the order tracking page. Read-only
 * (no upload/delete): shows the before/after comparison + gallery the laundry
 * captured. Per-image onError → a "foto dihapus" fallback tile, so a deleted or
 * expired file never renders as a broken image. Hidden entirely when there are
 * no live photos.
 */
export function TrackPhotosSection({ orderNumber }: Props) {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<ProofPhoto[] | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());

  useEffect(() => {
    let alive = true;
    apiFetch<ProofPhoto[]>(`/api/track/${orderNumber}/photos`)
      .then(({ data }) => alive && setPhotos(data))
      .catch(() => alive && setPhotos([]));
    return () => {
      alive = false;
    };
  }, [orderNumber]);

  if (!photos || photos.length === 0) return null;

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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/10 text-brand">
          <Camera className="h-4 w-4" />
        </div>
        <h2 className="text-sm font-bold text-slate-900">
          {t("tracking.photosTitle")}
        </h2>
      </div>

      <ProofPhotosView
        photos={photos}
        baseUrl={`/api/track/${orderNumber}/photos`}
        labels={labels}
        goneIds={gone}
        onPhotoError={(id) =>
          setGone((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
          })
        }
      />

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        {t("tracking.photosPrivacy")}
      </p>
    </div>
  );
}
