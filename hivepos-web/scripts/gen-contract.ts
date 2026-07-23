#!/usr/bin/env tsx
/**
 * gen-contract — regenerates the typed contract artifacts from contracts/openapi.yaml:
 *   1. lib/api/types.ts        (openapi-typescript → drift-proof request/response types)
 *   2. docs/contracts/<tag>.md (human/agent-readable contract per domain — build instructions)
 *
 * Run via `npm run gen:contract` (also runs in prebuild + CI drift guard).
 *
 * ponytail: MD emitter is ~50 lines of js-yaml + string concat instead of a heavy
 * doc generator (redocly/widdershins) — enough for agents to know what to build,
 * upgrade path if richer rendering needed.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import yaml from "js-yaml";

const ROOT = resolve(import.meta.dirname, "..");
const SPEC_PATH = resolve(ROOT, "contracts/openapi.yaml");
const TYPES_OUT = resolve(ROOT, "lib/api/types.ts");
const MD_DIR = resolve(ROOT, "docs/contracts");

type Spec = {
  info?: { title?: string; version?: string };
  tags?: { name: string; description?: string }[];
  paths?: Record<string, Record<string, any>>;
  components?: { schemas?: Record<string, any> };
};

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

const refName = (ref?: string): string | null =>
  ref ? ref.split("/").pop() ?? null : ref ?? null;

function schemaRefOf(obj: any): string | null {
  if (!obj || typeof obj !== "object") return null;
  const schema = obj.schema;
  if (!schema) return null;
  if (schema.$ref) return refName(schema.$ref);
  if (schema.allOf) {
    // envelope pattern: pick the entry that defines `data`
    for (const part of schema.allOf) {
      const d = part?.properties?.data;
      if (d?.$ref) return refName(d.$ref);
    }
    return schema.allOf.find((p: any) => p.$ref) ? refName(schema.allOf.find((p: any) => p.$ref).$ref) : null;
  }
  return null;
}

function run() {
  // 1. Types via openapi-typescript CLI.
  console.log("▸ generating lib/api/types.ts …");
  execFileSync("npx", ["openapi-typescript", SPEC_PATH, "-o", TYPES_OUT], {
    stdio: "inherit",
    cwd: ROOT,
  });

  // 2. MD per domain.
  const spec = yaml.load(readFileSync(SPEC_PATH, "utf8")) as Spec;
  if (!existsSync(MD_DIR)) mkdirSync(MD_DIR, { recursive: true });
  // clear stale MD — but preserve hand-authored docs (gen only writes <tag>.md + README.md).
  // ponytail: hardcoded authored set — extend if more hand-written docs land in docs/contracts/.
  const AUTHORED = new Set(["BACKFILL.md", "AUDIT.md"]);
  for (const f of readdirSync(MD_DIR))
    if (f.endsWith(".md") && !AUTHORED.has(f)) unlinkSync(resolve(MD_DIR, f));

  const byTag: Record<string, any[]> = {};
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const op = (methods as any)[method];
      if (!op) continue;
      const tag = op.tags?.[0] ?? "untagged";
      (byTag[tag] ??= []).push({
        method: method.toUpperCase(),
        path,
        operationId: op.operationId,
        summary: op.summary ?? "",
        auth: Array.isArray(op.security) && op.security.length > 0 ? "bearer" : "—",
        body: schemaRefOf(op.requestBody?.content?.["application/json"]),
        success:
          schemaRefOf(op.responses?.["200"]?.content?.["application/json"]) ??
          schemaRefOf(op.responses?.["201"]?.content?.["application/json"]),
      });
    }
  }

  const title = spec.info?.title ?? "API";
  let index = `# ${title} contract\n\nGenerated from \`contracts/openapi.yaml\` — **do not edit**; run \`npm run gen:contract\`.\n\nThese docs are the build instructions for both hivepos-web (TS) and hivepos-api (Go).\n\n`;
  index += "| Domain | Endpoints |\n|---|---|\n";

  for (const [tag, ops] of Object.entries(byTag).sort()) {
    index += `| [${tag}](./${tag}.md) | ${ops.length} |\n`;
    let md = `# ${tag}\n\n> Source of truth: \`contracts/openapi.yaml\`. Generated — edit the YAML, not this file.\n\n`;
    md += "| Method | Path | Auth | Body | Response | Summary |\n|---|---|---|---|---|---|\n";
    for (const o of ops) {
      md += `| \`${o.method}\` | \`${o.path}\` | ${o.auth} | ${o.body ?? "—"} | ${o.success ?? "—"} | ${o.summary} |\n`;
    }
    md += `\n## Schemas\n\nSee \`contracts/openapi.yaml\` \`components.schemas\` for full field definitions. Types: \`lib/api/types.ts\`.\n`;
    writeFileSync(resolve(MD_DIR, `${tag}.md`), md);
  }
  writeFileSync(resolve(MD_DIR, "README.md"), index);
  console.log(`▸ wrote ${Object.keys(byTag).length} domain docs to docs/contracts/`);
}

run();
