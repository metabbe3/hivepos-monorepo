"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Draggable before/after comparison slider — the headline interaction for proof
 * photos. The "after" image is the base layer; the "before" image is clipped
 * (`clip-path: inset(0 {100-pos}% 0 0)`) so dragging the handle left/right
 * reveals more of one or the other. Pointer + keyboard accessible, no deps.
 */
interface Props {
  beforeUrl: string;
  afterUrl: string;
  beforeLabel: string;
  afterLabel: string;
  className?: string;
  /** Fired if either image fails to load (e.g. the file was deleted). */
  onError?: () => void;
}

export function BeforeAfterSlider({
  beforeUrl,
  afterUrl,
  beforeLabel,
  afterLabel,
  className,
  onError,
}: Props) {
  const [pos, setPos] = useState(50);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const setFromX = useCallback((clientX: number) => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.max(0, Math.min(100, pct)));
  }, []);

  return (
    <div
      ref={wrapRef}
      className={`relative select-none overflow-hidden rounded-xl bg-zinc-900 ${
        className ?? ""
      }`}
      style={{ aspectRatio: "4 / 3", cursor: "ew-resize", touchAction: "none" }}
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (dragging.current) setFromX(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      {/* AFTER = base layer (full bleed) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={afterUrl}
        alt={afterLabel}
        draggable={false}
        onError={onError}
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/* BEFORE = clipped overlay revealed from the left up to `pos` */}
      <div
        className="absolute inset-0"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={beforeUrl}
          alt={beforeLabel}
          draggable={false}
          onError={onError}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />
      </div>

      <span className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="pointer-events-none absolute right-2 top-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">
        {afterLabel}
      </span>

      {/* Divider + grab handle */}
      <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90" />
        <div
          role="slider"
          aria-label="Before / after"
          aria-valuenow={Math.round(pos)}
          aria-valuemin={0}
          aria-valuemax={100}
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - 4));
            if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + 4));
          }}
          className="absolute top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-lg ring-1 ring-black/10"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-zinc-700"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 7-5 5 5 5M15 7l5 5-5 5" />
          </svg>
        </div>
      </div>
    </div>
  );
}
