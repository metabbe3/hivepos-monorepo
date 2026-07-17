#!/usr/bin/env node
// Generate the service-worker cache VERSION into public/sw.js so every build
// auto-invalidates returning PWAs — no hand-bumped date string to forget.
//
//   prebuild:  writes the real VERSION (SW_VERSION env → git short SHA → timestamp)
//   postbuild: restores the "dev" placeholder — BUT only on the host (.git present),
//              so the committed source stays clean. In Docker (.git excluded from
//              context) the real version is preserved in the built artifact.
//
// Deterministic per-commit: `docker compose build --build-arg SW_VERSION=$(git rev-parse --short HEAD)`.
// Without the arg, Docker falls back to a build timestamp (invalidates every build —
// the desired behavior for deploys).

import { readFile, writeFile, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SW = fileURLToPath(new URL("../public/sw.js", import.meta.url));
const GIT_DIR = new URL("../.git", import.meta.url);
const VERSION_RE = /(const VERSION = )"[^"]*"(;)/;

const sanitize = (v) => String(v).replace(/["'\s]/g, "").slice(0, 40) || "dev";

// execFileSync with a fixed argv — no shell, no injection surface.
function resolveVersion() {
  if (process.env.SW_VERSION) return sanitize(process.env.SW_VERSION);
  try {
    return sanitize(
      execFileSync("git", ["rev-parse", "--short", "HEAD"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      }),
    );
  } catch {
    return sanitize("build-" + Date.now());
  }
}

async function hasGit() {
  try {
    await stat(GIT_DIR);
    return true;
  } catch {
    return false;
  }
}

const restore = process.argv.includes("--restore");

// postbuild on Docker (no .git): keep the real version the prebuild wrote.
if (restore && !(await hasGit())) {
  console.log("sw.js: keeping generated VERSION (Docker build, no .git)");
  process.exit(0);
}

const value = restore ? "dev" : resolveVersion();
const text = await readFile(SW, "utf8");
const next = text.replace(VERSION_RE, `$1"${value}"$2`);
if (next === text) {
  console.error("sw.js: VERSION line not found — aborting");
  process.exit(1);
}
await writeFile(SW, next);
console.log(`sw.js: VERSION -> "${value}"${restore ? " (restored placeholder)" : ""}`);
