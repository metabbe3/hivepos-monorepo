"use client";

import { useEffect, useState } from "react";

// Sticky table of contents built from the rendered <article> h2 anchors.
// Scrollspy highlights the section in view. Renders nothing until headings mount
// and only shows when there are enough sections to justify it.
export function TableOfContents() {
  const [heads, setHeads] = useState<{ id: string; text: string }[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("article h2[id]"));
    const items = els.map((e) => ({ id: e.id, text: e.textContent?.trim() ?? "" }));
    setHeads(items);
    if (items[0]) setActive(items[0].id);

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive((visible[0].target as HTMLElement).id);
      },
      { rootMargin: "-90px 0px -70% 0px", threshold: 0 },
    );
    els.forEach((e) => obs.observe(e));
    return () => obs.disconnect();
  }, []);

  if (heads.length < 3) return null;

  return (
    <nav aria-label="Daftar isi" className="text-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">Daftar Isi</p>
      <ul className="space-y-2.5 border-l border-slate-200">
        {heads.map((h) => {
          const isActive = active === h.id;
          return (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                className={
                  "-ml-px block border-l-2 py-0.5 pl-4 transition-colors " +
                  (isActive
                    ? "border-brand font-semibold text-brand"
                    : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800")
                }
              >
                {h.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
