// Single source of truth for the hivePOS brand mark + wordmark.
// Used by: landing nav/footer, auth pages, app sidebars, public navbar,
// and the dynamic icon/opengraph-image route handlers.

// Lucide `Zap` path (solid). Inlined so ImageResponse / SVG render identically
// without needing the lucide runtime at the icon route.
const ZAP_PATH = "M13 2L3 14h9l-1 8 10-12h-9l1-8z";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d={ZAP_PATH} />
    </svg>
  );
}

/**
 * Full lockup: mark in indigo gradient box + "hivePOS" wordmark.
 * size="sm" → 9×9 box (sidebar / compact), size="md" → 10×10 box (landing / auth).
 */
export function BrandLogo({ size = "md" }: { size?: "sm" | "md" }) {
  const box =
    size === "sm" ? "h-9 w-9 rounded-lg" : "h-10 w-10 rounded-xl";
  const icon = size === "sm" ? "h-5 w-5" : "h-6 w-6";
  return (
    <span className="flex items-center gap-2 font-extrabold tracking-tight">
      <span
        className={`relative flex ${box} items-center justify-center bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-600/25`}
      >
        <BrandMark className={icon} />
      </span>
      <span className="text-xl">
        hive<span className="text-indigo-600">POS</span>
      </span>
    </span>
  );
}
