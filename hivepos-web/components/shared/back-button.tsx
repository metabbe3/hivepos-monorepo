"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Back button for detail pages. Checks for a `returnTo` query param (encoded
 * return URL with filter params); if present, navigates there directly —
 * guaranteed filter preservation. Falls back to `router.back()`.
 *
 * Self-wraps in Suspense so callers don't need their own boundary for useSearchParams.
 */
export function BackButton({
  label = "Kembali",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <Suspense
      fallback={
        <button type="button" className={cn("inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground", className)}>
          <ArrowLeft className="h-4 w-4" />
          {label}
        </button>
      }
    >
      <BackButtonInner label={label} className={className} />
    </Suspense>
  );
}

function BackButtonInner({ label, className }: { label: string; className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("returnTo");

  return (
    <button
      type="button"
      onClick={() => {
        if (returnTo) router.push(decodeURIComponent(returnTo));
        else router.back();
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md",
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4" />
      {label}
    </button>
  );
}
