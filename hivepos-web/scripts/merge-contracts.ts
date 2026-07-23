#!/usr/bin/env tsx
/**
 * merge-contracts — combines contracts/openapi.yaml (base) with every
 * contracts/_staging/*.yaml fragment into the final openapi.yaml.
 *
 * Used during the contract backfill: each domain's contract agent writes a
 * self-contained fragment (tags + paths + components.schemas) to _staging/;
 * this script deep-merges them into openapi.yaml, ERRORING on path/method and
 * schema-name collisions — so parallel agents can never clobber each other or
 * the base spec.
 *
 * Run after the backfill agents, before `npm run gen:contract`:
 *   npx tsx scripts/merge-contracts.ts
 *
 * ponytail: js-yaml round-trip normalizes formatting (drops inline // comments)
 * — acceptable: the YAML is now a tool-managed artifact; docs/contracts/*.md is
 * the human-readable layer. Upgrade to a comment-preserving merge only if the
 * normalized format blocks review.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";

const ROOT = resolve(import.meta.dirname, "..");
const SPEC = resolve(ROOT, "contracts/openapi.yaml");
const STAGE = resolve(ROOT, "contracts/_staging");

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function run() {
  const base = yaml.load(readFileSync(SPEC, "utf8")) as Record<string, any>;
  base.paths ??= {};
  base.components ??= {};
  base.components.schemas ??= {};
  base.tags ??= [];

  const tagNames = new Set((base.tags as any[]).map((t) => t.name));
  let addedPaths = 0;
  let addedSchemas = 0;
  let fragments = 0;
  // Shared helper / base schemas that fragments legitimately re-declare (they
  // $ref the base building block). Duplicates of these are skipped silently.
  // Any OTHER duplicate SCHEMA is a real cross-domain entity collision (e.g. two
  // domains both defining `Order`) → throw so the author namespaces it. This is
  // what stops a future backfill from silently overwriting a domain entity with
  // another domain's shape. (Responses/parameters are reusable infra — warn+skip.)
  const SHARED_SCHEMAS = new Set([
    "EnvelopeSuccess", "ErrorEnvelope", "ErrorBody", "OkEnvelope", "OkData",
    "OkResult", "PaginationMeta", "SessionVersionData", "SessionVersionEnvelope",
  ]);
  // Backfill fragments independently declare shared helper schemas (envelopes,
  // generic { ok:true } shapes). First-writer-wins for a given name; we collect
  // the skipped duplicates and print them so a real cross-domain ENTITY collision
  // (not a shared helper) is visible and can be fixed.
  const skippedDupes: Record<string, string[]> = {};

  if (!existsSync(STAGE)) {
    console.log("No _staging dir — nothing to merge.");
    return;
  }
  const files = readdirSync(STAGE)
    .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
    .sort();

  for (const f of files) {
    fragments++;
    const frag = yaml.load(readFileSync(resolve(STAGE, f), "utf8")) as Record<string, any>;

    for (const t of (frag.tags ?? []) as any[]) {
      if (!tagNames.has(t.name)) {
        (base.tags as any[]).push(t);
        tagNames.add(t.name);
      }
    }

    for (const [path, methods] of Object.entries<any>(frag.paths ?? {})) {
      if (base.paths[path]) {
        for (const [m, op] of Object.entries<any>(methods)) {
          if (base.paths[path][m]) {
            throw new Error(`duplicate path+method: ${m.toUpperCase()} ${path} (fragment ${f})`);
          }
          base.paths[path][m] = op;
        }
      } else {
        base.paths[path] = methods;
        addedPaths++;
      }
    }

    // Deep-merge EVERY component sub-section (schemas, responses, parameters,
    // securitySchemes, requestBodies, …) — not just schemas. Fragments define
    // reusable responses (e.g. Forbidden) and shared path parameters that must
    // survive the merge or their $refs won't resolve.
    for (const [section, entries] of Object.entries<any>(frag.components ?? {})) {
      base.components[section] ??= {};
      for (const [name, def] of Object.entries<any>(entries)) {
        if (base.components[section][name]) {
          // Real cross-domain ENTITY collisions live in `schemas`. Shared helper
          // schemas are re-declared by most fragments — allow those. Anything else
          // duplicating a schema is a latent contract bug: throw so the author
          // namespaces it (or adds it to SHARED_SCHEMAS if genuinely shared).
          // Responses/parameters are reusable infra → warn + skip (first-writer-wins).
          if (section === "schemas" && !SHARED_SCHEMAS.has(name)) {
            throw new Error(
              `duplicate schema "${name}" in ${f} — namespaces it (e.g. Domain${name}) ` +
                `or, if it's a shared helper, add it to SHARED_SCHEMAS in merge-contracts.ts`,
            );
          }
          (skippedDupes[`${section}:${name}`] ??= []).push(f);
          continue;
        }
        base.components[section][name] = def;
        if (section === "schemas") addedSchemas++;
      }
    }
  }

  // Deterministic ordering keeps the generated spec diff-stable across re-merges.
  base.paths = Object.fromEntries(Object.keys(base.paths).sort(cmp).map((k) => [k, base.paths[k]]));
  base.components.schemas = Object.fromEntries(
    Object.keys(base.components.schemas).sort(cmp).map((k) => [k, base.components.schemas[k]]),
  );
  (base.tags as any[]).sort((a, b) => cmp(a.name, b.name));

  writeFileSync(SPEC, yaml.dump(base, { lineWidth: 100, noRefs: true, quotingType: '"' }));
  console.log(
    `✓ Merged ${fragments} fragment(s): +${addedPaths} paths, +${addedSchemas} schemas. ` +
      `Total: ${Object.keys(base.paths).length} paths, ${Object.keys(base.components.schemas).length} schemas, ${base.tags.length} tags.`,
  );
  const dupeNames = Object.keys(skippedDupes).sort();
  if (dupeNames.length) {
    console.log(
      `\nSkipped ${dupeNames.length} duplicate schema name(s) (first-writer-wins; verify these are shared helpers, not domain entities):\n  ` +
        dupeNames.map((n) => `${n} ← ${skippedDupes[n].join(", ")}`).join("\n  "),
    );
  }
}

run();
