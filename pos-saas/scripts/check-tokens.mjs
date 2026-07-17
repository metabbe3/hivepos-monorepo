#!/usr/bin/env node
// Token-drift gate: fail if in-app surfaces bypass the bg-card/bg-background/
// bg-popover token system with raw bg-white + dark:bg-gray-* overrides (which
// render mismatched shades in dark mode — gray-800 #1f2937 ≠ --color-card dark
// #111118). Run via `npm run lint:tokens`; wire into CI to prevent recurrence.
//
// Allowlist: public/landing surfaces (white is the brand surface), the thermal
// receipt (paper must be white), and preview swatches — all enumerated below.

import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = new URL("../", import.meta.url).pathname;

// In-app surfaces that share the indigo dark-mode token system.
const SCAN_DIRS = [
  "app/(dashboard)",
  "components/dashboard",
  "components/orders",
  "components/customers",
  "components/pos",
  "components/shared",
];

// Hard forbidden anywhere in SCAN_DIRS: the gray-800/700/900 dark overrides.
const FORBIDDEN = /dark:bg-gray-(?:700|800|900)(?:\/\d+)?/;

// Bare bg-white (no opacity modifier) is drift in most card/surface contexts.
// bg-white/NN (semi-transparent overlays, badges) is fine — the regex excludes it.
const BARE_BG_WHITE = /\bbg-white(?!\/)/;

// Explicit intentional bg-white allowlist (path substrings).
const ALLOW_BG_WHITE = [
  "laundry/orders/[id]/receipt/page.tsx",     // thermal receipt paper
  "branches/[id]/page.tsx",                   // receipt-paper size preview swatch
  "attendance/clock/page.tsx",                // white status dot on emerald band
];

const allowlistHit = (p) => ALLOW_BG_WHITE.some((a) => p.includes(a));

const violations = [];

async function walk(dir, files = []) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const e of entries) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) await walk(full, files);
    else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(full);
  }
  return files;
}

for (const d of SCAN_DIRS) {
  const files = await walk(join(ROOT, d));
  for (const f of files) {
    const rel = relative(ROOT, f);
    const text = await readFile(f, "utf8").catch(() => "");
    const lines = text.split("\n");
    lines.forEach((line, i) => {
      if (FORBIDDEN.test(line)) {
        violations.push(`${rel}:${i + 1}: dark:bg-gray-* override (use bg-card token)`);
      }
      if (BARE_BG_WHITE.test(line) && !allowlistHit(rel)) {
        violations.push(`${rel}:${i + 1}: bare bg-white (use bg-card/bg-background/bg-popover token)`);
      }
    });
  }
}

if (violations.length) {
  console.error(`✗ token-drift gate failed (${violations.length}):\n`);
  for (const v of violations) console.error("  " + v);
  console.error("\nUse bg-card / bg-background / bg-popover tokens (they flip in dark mode).");
  console.error("If bg-white is intentional, add the file to ALLOW_BG_WHITE in scripts/check-tokens.mjs.");
  process.exit(1);
}
console.log(`✓ token-drift gate passed (scanned ${SCAN_DIRS.length} dirs).`);
