"use client";

import { useState } from "react";
import { ImageOff, Trash2 } from "lucide-react";
import { BeforeAfterSlider } from "./before-after-slider";
import { PhotoLightbox } from "./photo-lightbox";
import { pickBeforeAfterPair } from "@/lib/photo-pair";

export interface ProofPhoto {
  id: string;
  kind: string;
  createdAt: string;
  bytes?: number | null;
}

export interface ProofLabels {
  before: string;
  after: string;
  damage: string;
  compare: string;
  compareHint: string;
  next: string;
  prev: string;
  close: string;
  delete: string;
  deletedTile: string;
}

interface Props {
  photos: ProofPhoto[];
  /** Base URL that serves a photo by id, e.g. `/api/orders/{id}/photos`. */
  baseUrl: string;
  labels: ProofLabels;
  /** Dashboard delete; omitted for the read-only tracking view. */
  onDelete?: (id: string) => void;
  /** Fired when a thumbnail fails to load (deleted/expired file). */
  onPhotoError?: (id: string) => void;
  /** ids whose file is known-gone → render the fallback tile instead. */
  goneIds?: Set<string>;
}

const KIND_DOT: Record<string, string> = {
  before: "bg-zinc-300",
  after: "bg-emerald-400",
  damage: "bg-amber-400",
};

/**
 * Comparison slider + thumbnail gallery + lightbox. The single rendering path
 * for proof photos — used by the dashboard section (with delete) and the
 * customer tracking page (read-only, with deleted-file fallback tiles).
 */
export function ProofPhotosView({
  photos,
  baseUrl,
  labels,
  onDelete,
  onPhotoError,
  goneIds,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const pair = pickBeforeAfterPair(photos);
  const hasPair = Boolean(pair.before && pair.after);
  const url = (id: string) => `${baseUrl}/${id}`;

  const kindLabel = (kind: string) =>
    kind === "before" ? labels.before : kind === "after" ? labels.after : labels.damage;

  return (
    <div className="space-y-4">
      {hasPair && (
        <div className="rounded-xl border border-border/60 bg-card p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{labels.compare}</p>
            <span className="text-[11px] text-muted-foreground">
              {labels.compareHint}
            </span>
          </div>
          <BeforeAfterSlider
            beforeUrl={url(pair.before!.id)}
            afterUrl={url(pair.after!.id)}
            beforeLabel={labels.before}
            afterLabel={labels.after}
          />
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((p, i) => {
          const gone = goneIds?.has(p.id);
          const label = kindLabel(p.kind);
          return (
            <div
              key={p.id}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              {gone ? (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500">
                  <ImageOff className="h-5 w-5" />
                  <span className="px-1 text-center text-[10px] font-medium leading-tight">
                    {labels.deletedTile}
                  </span>
                </span>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setLightboxIndex(i)}
                    className="absolute inset-0 h-full w-full cursor-zoom-in"
                    aria-label={label}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url(p.id)}
                      alt={label}
                      loading="lazy"
                      onError={() => onPhotoError?.(p.id)}
                      className="h-full w-full object-cover"
                    />
                  </button>
                  <span className="pointer-events-none absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        KIND_DOT[p.kind] ?? "bg-zinc-300"
                      }`}
                    />
                    {label}
                  </span>
                  {onDelete && (
                    <button
                      type="button"
                      aria-label={labels.delete}
                      onClick={() => onDelete(p.id)}
                      className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/55 text-white opacity-0 backdrop-blur-sm transition-opacity focus:opacity-100 group-hover:opacity-100"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      <PhotoLightbox
        photos={photos.map((p) => ({
          id: p.id,
          kind: p.kind,
          url: url(p.id),
          createdAt: p.createdAt,
          bytes: p.bytes,
        }))}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        onDelete={onDelete}
        labels={labels}
      />
    </div>
  );
}
