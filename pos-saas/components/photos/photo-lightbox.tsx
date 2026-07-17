"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export interface LightboxPhoto {
  id: string;
  kind: string;
  url: string;
  createdAt: string;
  bytes?: number | null;
}

export interface LightboxLabels {
  before: string;
  after: string;
  damage: string;
  close: string;
  next: string;
  prev: string;
  delete: string;
}

interface Props {
  photos: LightboxPhoto[];
  /** null = closed; otherwise the visible photo's index. */
  index: number | null;
  onIndexChange: (i: number | null) => void;
  /** When provided, a delete button is shown (dashboard only). */
  onDelete?: (id: string) => void;
  labels: LightboxLabels;
}

/**
 * Dark, image-forward lightbox. Controlled via `index` (null = closed).
 * Prev/next chevrons + ←/→/Esc keyboard nav. Optional delete for the dashboard.
 * The deleted-file fallback is handled at the gallery level (per-image onError),
 * so by the time a photo is opened here its thumbnail already loaded.
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onDelete,
  labels,
}: Props) {
  const open = index !== null;
  const photo = open ? photos[index!] : undefined;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && index! > 0) onIndexChange(index! - 1);
      if (e.key === "ArrowRight" && index! < photos.length - 1)
        onIndexChange(index! + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, index, photos.length, onIndexChange]);

  if (!photo) return null;

  const kindLabel =
    photo.kind === "before"
      ? labels.before
      : photo.kind === "after"
        ? labels.after
        : labels.damage;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onIndexChange(null)}>
      <DialogContent
        showCloseButton={false}
        className="max-w-[calc(100%-2rem)] gap-0 bg-zinc-950/95 p-0 ring-white/10 sm:max-w-3xl"
      >
        <DialogTitle className="sr-only">{kindLabel}</DialogTitle>

        <div className="relative flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt={kindLabel}
            className="max-h-[72vh] w-full rounded-t-xl object-contain"
          />

          {photos.length > 1 && index! > 0 && (
            <button
              type="button"
              aria-label={labels.prev}
              onClick={() => onIndexChange(index! - 1)}
              className="absolute left-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {photos.length > 1 && index! < photos.length - 1 && (
            <button
              type="button"
              aria-label={labels.next}
              onClick={() => onIndexChange(index! + 1)}
              className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white/30"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 rounded-b-xl bg-zinc-950 px-4 py-2.5 text-white">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs">
            <span className="rounded bg-white/15 px-2 py-0.5 font-semibold">
              {kindLabel}
            </span>
            <span className="text-white/60">
              {new Date(photo.createdAt).toLocaleString("id-ID", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            {photo.bytes ? (
              <span className="text-white/40">
                {Math.round(photo.bytes / 1024)} KB
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onDelete && (
              <button
                type="button"
                aria-label={labels.delete}
                onClick={() => onDelete(photo.id)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              aria-label={labels.close}
              onClick={() => onIndexChange(null)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
