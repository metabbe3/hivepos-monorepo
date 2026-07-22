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

/** Slugify heading text → URL-safe anchor id (Indonesian-safe, strips punctuation). */
export function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Inject deduplicated `id` anchors on <h2>–<h4> so the table of contents +
 * "#section" deep links work. Regex post-process (version-proof vs marked's
 * renderer API). Returns the heading list [{id,text,level}] as a side channel.
 */
function addHeadingAnchors(html: string): { html: string; headings: { id: string; text: string; level: number }[] } {
  const headings: { id: string; text: string; level: number }[] = [];
  const seen = new Set<string>();
  const out = html.replace(/<h([2-4])>([\s\S]*?)<\/h\1>/g, (_m, level: string, inner: string) => {
    const text = inner.replace(/<[^>]+>/g, "").trim();
    let id = slugifyHeading(text);
    if (!id) id = `section-${headings.length + 1}`;
    let n = 2;
    while (seen.has(id)) id = `${slugifyHeading(text)}-${n++}`;
    seen.add(id);
    headings.push({ id, text, level: Number(level) });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  return { html: out, headings };
}

/** Render Markdown source to sanitized HTML (server-side, for /blog/[slug]). */
export function renderMarkdown(md: string): string {
  if (!md) return "";
  const { html } = addHeadingAnchors(sanitize(marked.parse(md) as string));
  return html;
}

/** Render Markdown + extract the heading outline (for the table of contents). */
export function renderMarkdownWithOutline(md: string): { html: string; headings: { id: string; text: string; level: number }[] } {
  if (!md) return { html: "", headings: [] };
  return addHeadingAnchors(sanitize(marked.parse(md) as string));
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
