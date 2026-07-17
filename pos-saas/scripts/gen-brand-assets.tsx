// Generate 4K brand PNGs (mark + lockup) on transparent and white backgrounds.
// Run: npx tsx scripts/gen-brand-assets.tsx
// Output: public/brand/*.png

import { ImageResponse } from "next/og";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import react from "react";

const ZAP_PATH = "M13 2L3 14h9l-1 8 10-12h-9l1-8z";
const SQ = 3840;
const LOCKUP_W = 3840;
const LOCKUP_H = 1080;

const e = react.createElement;

async function render(jsx: React.ReactElement, w: number, h: number, filename: string) {
  const res = new ImageResponse(jsx, { width: w, height: h });
  const buf = Buffer.from(await res.arrayBuffer());
  const out = path.join("public", "brand", filename);
  await writeFile(out, buf);
  console.log(`  ✓ ${out}  (${w}×${h}, ${(buf.length / 1024).toFixed(0)} KB)`);
}

// Satori complains on `background: undefined` — only set the key when a bg color exists.
function rootStyle(bg: string | undefined) {
  const base: Record<string, string | number> = {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  if (bg) base.background = bg;
  return base;
}

function Mark(bg: string | undefined) {
  return e("div", { style: rootStyle(bg) },
    e("div", {
      style: {
        width: "75%",
        height: "75%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #6366f1, #4338ca)",
        borderRadius: Math.round(SQ * 0.15),
      },
    },
      e("svg", {
        viewBox: "0 0 24 24",
        width: Math.round(SQ * 0.42),
        height: Math.round(SQ * 0.42),
        fill: "#ffffff",
      },
        e("path", { d: ZAP_PATH })
      )
    )
  );
}

function Lockup(bg: string | undefined) {
  return e("div", {
    style: {
      ...rootStyle(bg),
      justifyContent: "flex-start",
      padding: `0 ${Math.round(LOCKUP_H * 0.15)}px`,
      gap: Math.round(LOCKUP_H * 0.15),
      fontFamily: "sans-serif",
    },
  },
    e("div", {
      style: {
        width: Math.round(LOCKUP_H * 0.75),
        height: Math.round(LOCKUP_H * 0.75),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #6366f1, #4338ca)",
        borderRadius: Math.round(LOCKUP_H * 0.12),
      },
    },
      e("svg", {
        viewBox: "0 0 24 24",
        width: Math.round(LOCKUP_H * 0.42),
        height: Math.round(LOCKUP_H * 0.42),
        fill: "#ffffff",
      },
        e("path", { d: ZAP_PATH })
      )
    ),
    e("div", {
      style: {
        display: "flex",
        fontSize: Math.round(LOCKUP_H * 0.45),
        fontWeight: 800,
        letterSpacing: "-0.03em",
        color: "#18181b",
      },
    },
      e("span", null, "hive"),
      e("span", { style: { color: "#4f46e5" } }, "POS"),
    )
  );
}

(async () => {
  await mkdir(path.join("public", "brand"), { recursive: true });
  console.log(`🎨 Generating 4K brand PNGs into public/brand/ ...`);

  await render(Mark(undefined), SQ, SQ, "mark-transparent-4k.png");
  await render(Mark("#ffffff"), SQ, SQ, "mark-white-4k.png");

  await render(Lockup(undefined), LOCKUP_W, LOCKUP_H, "lockup-transparent-4k.png");
  await render(Lockup("#ffffff"), LOCKUP_W, LOCKUP_H, "lockup-white-4k.png");

  console.log("Done.");
})();
