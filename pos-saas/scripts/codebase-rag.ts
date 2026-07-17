#!/usr/bin/env tsx
/**
 * Codebase RAG — structural index + retrieval. See docs/specs/codebase-rag.md.
 *
 * Principles: AST extraction (TS compiler API), not LLM. Deterministic summaries
 * (JSDoc + signature) — zero LLM at index time. Per-symbol SHA-256 delta sync.
 * Local JSON store + in-memory lexical retrieval (no DB service, no embeddings
 * needed at this scale). One chunk = one symbol (function/class/component/...).
 *
 * Usage:
 *   npx tsx scripts/codebase-rag.ts index [--llm-summarize]
 *   npx tsx scripts/codebase-rag.ts query "<term>" [-n 10]
 *   npx tsx scripts/codebase-rag.ts symbol <name>
 *   npx tsx scripts/codebase-rag.ts callers <name>
 *   npx tsx scripts/codebase-rag.ts stats
 */

import ts from "typescript";
import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const SRC_DIRS = ["app", "components", "lib", "modules", "hooks"];
const STORE_DIR = ".codebase-rag";
const INDEX_PATH = path.join(STORE_DIR, "index.json");
const SKIP_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "generated",
  "__pycache__", STORE_DIR, "coverage", "test-results", ".playwright-mcp",
]);
// Names too generic to be useful as call references (would match everything).
const STOP_NAMES = new Set([
  "props", "state", "data", "result", "value", "item", "items", "error",
  "req", "res", "ctx", "use", "set", "get", "new", "this", "true", "false",
  "null", "undefined", "return", "function", "const", "let", "var", "if",
  "for", "map", "filter", "forEach", "then", "catch", "await", "async",
]);

// Bump when the extractor or index shape changes. Delta sync is file-hash based,
// so without this a new extractor never re-runs on unchanged files (the "0 files
// changed" staleness). A mismatch discards the old index → full rebuild.
const INDEX_FORMAT = 2;

export interface Param { name: string; type: string }
export interface Symbol {
  id: string;          // `${file_path}:${name}`
  name: string;
  kind: string;        // function | component | hook | class | method | type | interface | const | route
  file_path: string;
  startLine: number;
  endLine: number;
  inputs: Param[];
  outputs: string;
  summary: string;     // JSDoc or synthesized — the retrieval key
  called_by: string[]; // ids that reference this symbol (approx, incoming)
  calls: string[];     // ids this symbol references (approx, outgoing)
  file_hash: string;   // sha256(code) — delta-sync key
  code: string;        // the source snippet
}
interface Index {
  format?: number;
  files: Record<string, { mtime: number; hash: string }>;
  symbols: Record<string, Symbol>;
}

// ── helpers ──────────────────────────────────────────────────────────────
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

async function loadIndex(): Promise<Index> {
  try {
    return JSON.parse(await readFile(INDEX_PATH, "utf8"));
  } catch {
    return { files: {}, symbols: {} };
  }
}

async function walk(dir: string, acc: string[] = []): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try { entries = await readdir(dir, { withFileTypes: true }); }
  catch { return acc; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.(test|spec)\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

// ── AST extraction ───────────────────────────────────────────────────────
export function extractSymbols(relPath: string, content: string): Symbol[] {
  const isTsx = relPath.endsWith(".tsx");
  const sf = ts.createSourceFile(
    relPath, content, ts.ScriptTarget.Latest, true,
    isTsx ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: Symbol[] = [];
  const fullText = sf.text;
  const lineOf = (pos: number) => sf.getLineAndCharacterOfPosition(pos).line + 1;
  const textOf = (n: ts.Node) => fullText.slice(n.getStart(sf, false), n.getEnd());
  const typeText = (n?: ts.TypeNode) => (n ? n.getText(sf) : "");

  const jsDoc = (node: ts.Node): string => {
    const docs = (node as unknown as { jsDoc?: ts.JSDoc[] }).jsDoc;
    if (!docs?.length) return "";
    const c = docs[0].comment;
    if (typeof c === "string") return c.trim().replace(/\s+/g, " ");
    if (Array.isArray(c)) return c.map((p) => (typeof p === "string" ? p : (p as { text?: string }).text ?? "")).join(" ").trim().replace(/\s+/g, " ");
    return "";
  };

  // Does the function body return JSX? (component detection)
  const returnsJsx = (body?: ts.ConciseBody | ts.Block): boolean => {
    if (!body) return false;
    let hit = false;
    const v = (n: ts.Node) => {
      if (hit) return;
      if (ts.isParenthesizedExpression(n) || ts.isJsxElement(n) || ts.isJsxFragment(n) || ts.isJsxSelfClosingElement(n)) {
        // only count if it's a return value or arrow body
        const parent = n.parent;
        if (parent && (ts.isReturnStatement(parent) || ts.isArrowFunction(parent) || ts.isParenthesizedExpression(parent))) hit = true;
      }
      ts.forEachChild(n, v);
    };
    v(body);
    return hit;
  };

  const make = (
    node: ts.Node, name: string, kind: string,
    inputs: Param[], outputs: string, summary: string,
  ): Symbol => {
    const code = textOf(node);
    const startLine = lineOf(node.getStart(sf, false));
    return {
      // Line-suffixed so nested same-name consts (e.g. two components each with
      // `const refresh = useCallback(...)`) get distinct ids, not collided.
      id: `${relPath}:${name}:${startLine}`,
      name, kind, file_path: relPath,
      startLine,
      endLine: lineOf(node.getEnd()),
      inputs, outputs, summary, called_by: [], calls: [],
      file_hash: sha256(code), code,
    };
  };

  const paramsOf = (pl: ts.NodeArray<ts.ParameterDeclaration>): Param[] =>
    pl.map((p) => ({ name: p.name.getText(sf), type: typeText(p.type) }));

  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node)) {
      const name = node.name?.text ?? "<anonymous>";
      const params = paramsOf(node.parameters);
      const ret = typeText(node.type);
      const isHook = /^use[A-Z]/.test(name);
      const isComp = returnsJsx(node.body);
      const kind = isComp ? "component" : isHook ? "hook" : "function";
      const summary = jsDoc(node) || `${kind} ${name}(${params.map((p) => p.name).join(", ")})${ret ? ": " + ret : ""}`;
      out.push(make(node, name, kind, params, ret || (isComp ? "JSX.Element" : ""), summary));
      ts.forEachChild(node, visit); // recurse: nested named consts (useCallback/useMemo)
      return;
    }
    if (ts.isClassDeclaration(node)) {
      const name = node.name?.text ?? "<anonymous>";
      out.push(make(node, name, "class", [], "", jsDoc(node) || `class ${name}`));
      for (const m of node.members) {
        if (ts.isMethodDeclaration(m) && !ts.isPrivateIdentifier(m.name)) {
          const mname = m.name.getText(sf);
          const params = paramsOf(m.parameters);
          const ret = typeText(m.type);
          out.push(make(m, `${name}.${mname}`, "method", params, ret, jsDoc(m) || `${name}.${mname}(${params.map((p) => p.name).join(", ")})`));
        }
      }
      ts.forEachChild(node, visit); // recurse into methods for nested named consts
      return;
    }
    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      out.push(make(node, name, "interface", [], "", jsDoc(node) || `interface ${name}`));
      return;
    }
    if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.text;
      out.push(make(node, name, "type", [], "", jsDoc(node) || `type ${name}`));
      return;
    }
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        const name = decl.name.getText(sf);
        const init = decl.initializer;
        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          const params = paramsOf(init.parameters);
          const isHook = /^use[A-Z]/.test(name);
          const body = init.body;
          const isComp = returnsJsx(body);
          const ret = typeText(init.type) || (isComp ? "JSX.Element" : body && !ts.isBlock(body) ? "=> " + body.getText(sf).slice(0, 40) : "");
          const kind = isComp ? "component" : isHook ? "hook" : "const";
          const summary = jsDoc(node) || jsDoc(decl) || `${kind} ${name}(${params.map((p) => p.name).join(", ")})`;
          out.push(make(decl, name, kind, params, ret, summary));
        } else if (init && ts.isCallExpression(init) && init.arguments.length > 0) {
          // const name = <HOF>(arrowFn, …) — useCallback/useMemo/custom hooks. The
          // initializer is a CallExpression whose first arg is the real function.
          const inner = init.arguments[0];
          if (ts.isArrowFunction(inner) || ts.isFunctionExpression(inner)) {
            const params = paramsOf(inner.parameters);
            const isHookName = /^use[A-Z]/.test(name);
            const body = inner.body;
            const isComp = returnsJsx(body);
            const ret = typeText(inner.type) || (isComp ? "JSX.Element" : body && !ts.isBlock(body) ? "=> " + body.getText(sf).slice(0, 40) : "");
            const kind = isComp ? "component" : isHookName ? "hook" : "function";
            const summary = jsDoc(node) || jsDoc(decl) || `${kind} ${name}(${params.map((p) => p.name).join(", ")})`;
            out.push(make(decl, name, kind, params, ret, summary));
          }
        } else if (init && ["GET", "POST", "PATCH", "PUT", "DELETE"].includes(name) && relPath.includes("/api/")) {
          // Next.js App Router handler
          const route = relPath.replace(/\/route\.tsx?$/, "").replace(/^app/, "");
          out.push(make(decl, `${name} ${route}`, "route", [], "Response", jsDoc(node) || `${name} ${route}`));
        }
        // plain data consts skipped (too noisy)
      }
      ts.forEachChild(node, visit); // recurse: nested named consts inside arrow/HOF bodies
      return;
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sf, visit);
  return out;
}

// ── called_by (incoming references, approx) ──────────────────────────────
// For each symbol, find every OTHER symbol whose code references this one's
// name. Incoming (who references me), per the blueprint's "called_by" field.
// Name-based → approximate (DI-wired services referenced only via instance
// names may be under-counted; common names are filtered).
export function recomputeCalledBy(symbols: Symbol[]): void {
  const nameToIds = new Map<string, string[]>();
  for (const s of symbols) {
    const names = s.name.includes(".") ? [s.name, s.name.split(".")[1]] : [s.name];
    for (const n of names) {
      if (n.length < 3 || STOP_NAMES.has(n)) continue;
      const arr = nameToIds.get(n) ?? [];
      arr.push(s.id);
      nameToIds.set(n, arr);
    }
  }
  const byId = new Map(symbols.map((s) => [s.id, s]));
  for (const s of symbols) { s.called_by = []; s.calls = []; }
  for (const s of symbols) {
    const tokens = s.code.match(/[A-Za-z_$][A-Za-z0-9_$]*/g) ?? [];
    const seen = new Set<string>();
    for (const tok of tokens) {
      const targetIds = nameToIds.get(tok);
      if (targetIds) for (const tid of targetIds) if (tid !== s.id) seen.add(tid);
    }
    for (const tid of seen) {
      byId.get(tid)?.called_by.push(s.id); // incoming: s references tid
      s.calls.push(tid);                   // outgoing: s references tid
    }
  }
  for (const s of symbols) {
    s.called_by = [...new Set(s.called_by)].slice(0, 50);
    s.calls = [...new Set(s.calls)].slice(0, 50);
  }
}

// ── index build (delta sync) ─────────────────────────────────────────────
async function buildIndex(): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  const raw = await loadIndex();
  // Format bump (extractor/index-shape change) → discard, force full rebuild.
  const existing = raw.format === INDEX_FORMAT ? raw : { files: {}, symbols: {} };
  const files: string[] = [];
  for (const d of SRC_DIRS) (await walk(d)).forEach((f) => files.push(f));

  const symbols: Record<string, Symbol> = {};
  const fileCache: Record<string, { mtime: number; hash: string }> = {};
  let changedFiles = 0;

  for (const file of files) {
    const rel = path.relative(ROOT, file).split(path.sep).join("/");
    const content = await readFile(file, "utf8");
    const contentHash = sha256(content);
    const st = await stat(file);
    fileCache[rel] = { mtime: Math.floor(st.mtimeMs), hash: contentHash };

    const prev = existing.files[rel];
    if (prev && prev.hash === contentHash) {
      // unchanged → reuse this file's existing symbols (delta sync)
      for (const s of Object.values(existing.symbols)) {
        if (s.file_path === rel) symbols[s.id] = s;
      }
      continue;
    }
    changedFiles++;
    for (const s of extractSymbols(rel, content)) symbols[s.id] = s;
    // (deleted files' symbols simply never get copied in → dropped)
  }

  const all = Object.values(symbols);
  recomputeCalledBy(all);

  await writeFile(INDEX_PATH, JSON.stringify({ format: INDEX_FORMAT, files: fileCache, symbols }));
  const byKind: Record<string, number> = {};
  for (const s of all) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  console.log(`✓ Indexed ${files.length} files → ${all.length} symbols (${changedFiles} file(s) changed).`);
  console.log("  by kind:", Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", "));
}

// ── retrieval ────────────────────────────────────────────────────────────
function loadSymbols(): Symbol[] {
  return Object.values(loadIndexSync().symbols);
}
function loadIndexSync(): Index {
  // small files, sync read is fine for query commands
  try { return JSON.parse(readFileSync(INDEX_PATH, "utf8")); }
  catch { console.error("No index found. Run: npx tsx scripts/codebase-rag.ts index"); process.exit(1); }
}

// ── retrieval: BM25 + lexical re-rank (no LLM, no embeddings) ───────────
// ponytail: pure-TS BM25 over weighted identifier-token fields. Semantic/vector
// layer (pgvector + embeddings) deferred — add if symbols >10k or lexical recall
// proves insufficient. Identifier splitting (camelCase/snake_case) is what lands
// exact-string queries like is_active_v2 / ERR_AUTH_501.
const K1 = 1.2;
const B = 0.75;
const RECALL_N = 25;

// Deterministic synonym map for pseudo-semantic recall. Maps common dev terms to
// their synonyms so BM25 can match "performance" queries against symbols named
// "optimize" or "latency". Zero LLM — just a static lookup table. Synonyms score
// at 0.5× BM25 weight (exact identifier matches still rank higher).
const SYNONYMS: Record<string, string[]> = {
  performance: ["latency", "speed", "slow", "fast", "optimize", "throughput", "perf"],
  auth: ["login", "session", "token", "password", "credentials", "oauth", "jwt"],
  payment: ["checkout", "stripe", "midtrans", "qris", "invoice", "transaction", "pay"],
  error: ["fail", "crash", "bug", "exception", "throw", "catch", "validation"],
  attendance: ["clock", "absen", "absensi", "pin", "timesheet", "shift"],
  offline: ["idb", "indexeddb", "sync", "outbox", "cache", "pending"],
  dashboard: ["metric", "stat", "chart", "report", "summary", "overview"],
  order: ["cart", "checkout", "lineitem", "garment", "laundry", "kiloan"],
  customer: ["pelanggan", "contact", "deposit", "wallet"],
  config: ["setting", "preference", "option", "env", "featureflag", "flag"],
  search: ["query", "find", "filter", "grep", "locate", "lookup"],
  export: ["csv", "excel", "download", "pdf", "print"],
  import: ["upload", "csv", "bulk", "batch"],
};

export function tokenize(raw: string): string[] {
  return raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2") // camelCase → space
    .replace(/[_\-./:()<>,;{}[\]"'`|=+!?@#&]+/g, " ") // separators → space
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !STOP_NAMES.has(t));
}

// Weighted token-frequency "document" for one symbol. Name subtokens weigh
// highest (exact identifier match is the strongest signal), summary mid, rest low.
export function bm25Doc(s: Symbol): Map<string, number> {
  const d = new Map<string, number>();
  const add = (raw: string, wt: number) => {
    for (const t of tokenize(raw)) d.set(t, (d.get(t) ?? 0) + wt);
  };
  add(s.name, 5);
  if (!s.name.includes(" ")) add(s.name.toLowerCase(), 5); // raw name token too
  add(s.summary, 2);
  add(s.code.slice(0, 240), 1);
  add(s.kind, 1);
  for (const p of s.inputs) add(p.name, 1);
  add(s.file_path, 1);
  return d;
}

// Stage-2 lexical re-rank: query↔symbol joint score (deterministic cross-encoder).
export function rerank(qLower: string, s: Symbol): number {
  const name = s.name.toLowerCase();
  const qTokens = tokenize(qLower);
  let score = 0;
  if (qLower && name === qLower) score += 100;
  if (qLower.length >= 3 && name.includes(qLower)) score += 40;
  if (name.length >= 3 && qLower.includes(name)) score += 25;
  if (qLower.length >= 2 && name.startsWith(qLower)) score += 20;
  const docTokens = new Set<string>([
    ...tokenize(s.name), ...tokenize(s.summary), ...tokenize(s.code.slice(0, 240)),
  ]);
  if (qTokens.length && docTokens.size) {
    const overlap = qTokens.filter((t) => docTokens.has(t)).length;
    score += 30 * (overlap / Math.max(qTokens.length, docTokens.size));
  }
  if (qLower.length >= 3 && s.summary.toLowerCase().includes(qLower)) score += 15;
  return score;
}

// Slice a symbol's code for --summarize mode: keep the signature line(s) + JSDoc,
// collapse the function body into a comment. Saves tokens for pure navigation queries.
function sliceCode(s: Symbol): string {
  const lines = s.code.split("\n");
  if (lines.length <= 8) return s.code; // short enough — don't slice
  // Keep the first line (signature) + any continuation lines until the first { or =>,
  // then collapse the rest.
  let cutAt = lines.length;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    if (lines[i].includes("{") || lines[i].includes("=>")) { cutAt = i + 1; break; }
  }
  const head = lines.slice(0, cutAt).join("\n");
  const collapsed = lines.length - cutAt;
  return `${head}\n  // [...] ${collapsed} lines collapsed (use without --summarize for full code)\n}`;
}

function query(term: string, k = 10, summarize = false): void {
  const qLower = term.toLowerCase().trim();
  const qTokens = tokenize(qLower);
  // Expand query tokens with synonyms (pseudo-semantic). Synonym tokens are tagged
  // so they can be scored at a lower weight than the original query tokens.
  const expanded: { token: string; weight: number }[] = qTokens.map((t) => ({ token: t, weight: 1 }));
  for (const qt of qTokens) {
    const syns = SYNONYMS[qt];
    if (syns) for (const s of syns) {
      if (!qTokens.includes(s) && !expanded.some((e) => e.token === s)) {
        expanded.push({ token: s, weight: 0.5 });
      }
    }
  }

  const symbols = loadSymbols();
  const N = symbols.length;

  // Stage 1 (recall): BM25 over weighted token docs.
  const docs = new Map<string, Map<string, number>>();
  const df = new Map<string, number>();
  let totalLen = 0;
  for (const s of symbols) {
    const d = bm25Doc(s);
    docs.set(s.id, d);
    let len = 0;
    for (const [t, c] of d) { len += c; df.set(t, (df.get(t) ?? 0) + 1); }
    totalLen += len;
  }
  const avgdl = N ? totalLen / N : 1;
  const staged: { s: Symbol; bm: number }[] = [];
  for (const s of symbols) {
    const d = docs.get(s.id)!;
    const dl = [...d.values()].reduce((a, b) => a + b, 0) || 1;
    let bm = 0;
    for (const { token: t, weight } of expanded) {
      const tf = d.get(t);
      if (!tf) continue;
      const dft = df.get(t) ?? 0;
      const idf = Math.log((N - dft + 0.5) / (dft + 0.5) + 1);
      bm += weight * idf * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + (B * dl) / avgdl)));
    }
    if (bm === 0 && qLower.length >= 2 &&
        (s.name.toLowerCase().includes(qLower) || s.summary.toLowerCase().includes(qLower))) {
      bm = 0.01;
    }
    if (bm > 0) staged.push({ s, bm });
  }
  staged.sort((a, b) => b.bm - a.bm);
  const candidates = staged.slice(0, RECALL_N);

  // Stage 2 (precision): lexical re-rank; BM25 breaks ties.
  const ranked = candidates
    .map(({ s, bm }) => ({ s, rr: rerank(qLower, s), bm }))
    .sort((a, b) => b.rr - a.rr || b.bm - a.bm);

  printHits(ranked.slice(0, k).map((x) => x.s), term, summarize);
}

function findByName(name: string): Symbol[] {
  const lower = name.toLowerCase();
  return loadSymbols().filter((s) => s.name.toLowerCase() === lower || s.name.toLowerCase().endsWith("." + lower));
}

function edges(name: string, field: "called_by" | "calls", arrow: "←" | "→", verb: string): void {
  const targets = findByName(name);
  if (!targets.length) { console.log(`No symbol named "${name}".`); return; }
  const refIds = new Set<string>();
  for (const t of targets) for (const id of t[field] ?? []) refIds.add(id);
  const byId = new Map(loadSymbols().map((s) => [s.id, s]));
  const refs = ([...refIds].map((id) => byId.get(id)).filter(Boolean) as Symbol[]);
  console.log(`\n${targets.map((t) => `▸ ${t.name} (${t.file_path}:${t.startLine})`).join("\n")}`);
  console.log(`  ${verb} ${refs.length} symbol(s):`);
  for (const r of refs.slice(0, 30)) console.log(`    ${arrow} ${r.kind} ${r.name}  ${r.file_path}:${r.startLine}`);
}
function callers(name: string): void { edges(name, "called_by", "←", "referenced by"); }
function callees(name: string): void { edges(name, "calls", "→", "calls"); }

function printHits(hits: Symbol[], label: string, summarize = false): void {
  if (!hits.length) { console.log(`No matches for "${label}".`); return; }
  const byId = new Map(loadSymbols().map((s) => [s.id, s]));
  const fmt = (id: string) => {
    const r = byId.get(id);
    return r ? `${r.kind} ${r.name} ${r.file_path}:${r.startLine}` : "";
  };
  console.log(`\nTop ${hits.length} for "${label}"${summarize ? " (summarized)" : ""}:\n`);
  for (const s of hits) {
    console.log(`▸ ${s.kind} ${s.name}  —  ${s.file_path}:${s.startLine}-${s.endLine}`);
    if (s.inputs.length) console.log(`  in:  ${s.inputs.map((p) => `${p.name}${p.type ? ": " + p.type : ""}`).join(", ")}`);
    if (s.outputs) console.log(`  out: ${s.outputs}`);
    console.log(`  ${summarize ? sliceCode(s).slice(0, 200) : s.summary.slice(0, 160)}`);
    const callers3 = (s.called_by ?? []).slice(0, 3).map(fmt).filter(Boolean).join("  ,  ");
    const callees3 = (s.calls ?? []).slice(0, 3).map(fmt).filter(Boolean).join("  ,  ");
    if (callers3) console.log(`  ← callers:  ${callers3}`);
    if (callees3) console.log(`  → callees:  ${callees3}`);
    console.log("");
  }
}

function stats(): void {
  const idx = loadIndexSync();
  const all = Object.values(idx.symbols);
  const byKind: Record<string, number> = {};
  for (const s of all) byKind[s.kind] = (byKind[s.kind] ?? 0) + 1;
  console.log(`files indexed: ${Object.keys(idx.files).length}`);
  console.log(`symbols: ${all.length}`);
  console.log("by kind:", Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(", "));
}

// ── CLI ──────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
let k = 10;
let summarize = false;
const positional: string[] = [];
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === "-n") k = parseInt(argv[++i], 10) || 10;
  else if (argv[i] === "--summarize") summarize = true;
  else positional.push(argv[i]);
}
const [cmd, ...rest] = positional;

// ponytail: main-module guard — importing this file (in tests) must NOT run the
// CLI. Resolves argv[1] to an absolute path and compares to this file's URL.
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) (async () => {
  switch (cmd) {
    case "index":
      await buildIndex();
      break;
    case "query":
      if (!rest.length) { console.log("usage: query <term>"); break; }
      query(rest.join(" "), k, summarize);
      break;
    case "symbol":
      if (!rest.length) { console.log("usage: symbol <name>"); break; }
      printHits(findByName(rest[0]), rest[0], summarize);
      break;
    case "callers":
      if (!rest.length) { console.log("usage: callers <name>"); break; }
      callers(rest[0]);
      break;
    case "callees":
      if (!rest.length) { console.log("usage: callees <name>"); break; }
      callees(rest[0]);
      break;
    case "stats":
      stats();
      break;
    default:
      console.log(`codebase-rag — structural code index
usage:
  npx tsx scripts/codebase-rag.ts index                 # build/update (SHA-256 delta sync)
  npx tsx scripts/codebase-rag.ts query "<term>" [-n 10] # lexical search
  npx tsx scripts/codebase-rag.ts symbol <name>          # exact-name lookup
  npx tsx scripts/codebase-rag.ts callers <name>         # who references it (←)
  npx tsx scripts/codebase-rag.ts callees <name>         # what it references (→)
  npx tsx scripts/codebase-rag.ts stats                  # coverage`);
  }
})();
