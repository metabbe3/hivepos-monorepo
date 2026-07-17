import { marked } from "marked";

// GFM + keep line content as-is (breaks:false → paragraphs need blank lines).
marked.setOptions({ gfm: true, breaks: false });

// ponytail: regex sanitize instead of DOMPurify — super-admin authors are
// trusted (they own the platform), but strip the obvious XSS vectors as
// defense-in-depth. Upgrade: add isomorphic-dompurify if untrusted authors ever
// contribute (e.g. guest writers).
function sanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:<(?!\/script>)[^<]*)*<\/script>/gi, "")
    .replace(/(<[^>]+)\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "$1")
    .replace(/(href|src)\s*=\s*("|\')javascript:[^"']*\2/gi, "$1=$2#$2");
}

/** Render Markdown source to sanitized HTML (server-side, for /blog/[slug]). */
export function renderMarkdown(md: string): string {
  if (!md) return "";
  return sanitize(marked.parse(md) as string);
}

/** Rough read-time estimate: words / 200 → "N menit". */
export function estimateReadTime(md: string): string {
  if (!md) return "1 menit";
  const words = md
    .replace(/[#>*_`~\-\[\]()!]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const mins = Math.max(1, Math.round(words / 200));
  return `${mins} menit`;
}
