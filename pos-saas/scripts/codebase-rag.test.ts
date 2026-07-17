// First tests for the codebase-RAG tool. Locks in (a) the HOF-const extraction
// fix (useCallback/useMemo/custom hooks), (b) the BM25 tokenizer, (c) re-rank
// ordering, (d) the callees/called_by edge recompute. Pure unit tests on
// synthetic TS source — no FS, no CLI subprocess.

import { describe, it, expect } from "vitest";
import {
  extractSymbols,
  tokenize,
  bm25Doc,
  rerank,
  recomputeCalledBy,
  type Symbol,
} from "./codebase-rag";

describe("extractSymbols", () => {
  it("indexes a useCallback const — the HOF-const gap (refresh/loadStats-style)", () => {
    const src = `
      import { useCallback } from "react";
      /** refresh the list */
      const refresh = useCallback(async () => {
        return fetch("/api/x");
      }, []);
      export interface Row { id: string }
      export function row() { return 1; }
    `;
    const syms = extractSymbols("lib/x.ts", src);
    expect(syms.map((s) => s.name)).toContain("refresh");
    const r = syms.find((s) => s.name === "refresh")!;
    expect(r.kind).toBe("function"); // not /^use[A-Z]/, not JSX → function
    expect(r.summary).toMatch(/refresh the list/); // JSDoc wins over synthesized
  });

  it("still indexes plain function declarations + interfaces", () => {
    const src = `export function foo(a: number): string { return "x"; }\nexport interface Bar { z: number }`;
    const syms = extractSymbols("lib/y.ts", src);
    expect(syms.find((s) => s.name === "foo" && s.kind === "function")).toBeTruthy();
    expect(syms.find((s) => s.name === "Bar" && s.kind === "interface")).toBeTruthy();
  });

  it("treats a /^use[A-Z]/ HOF const as a hook", () => {
    const src = `const useToggler = useCallback(() => true, []);`;
    const syms = extractSymbols("hooks/h.ts", src);
    const u = syms.find((s) => s.name === "useToggler");
    expect(u).toBeTruthy();
    expect(u!.kind).toBe("hook");
  });

  it("indexes useCallback/useMemo NESTED inside a function body (the real React pattern)", () => {
    const src = `
      export function useCrudResource() {
        const refresh = useCallback(async () => fetch("/api"), []);
        const create = useCallback(async (body: unknown) => post(body), []);
        const memod = useMemo(() => 42, []);
        return { refresh, create };
      }
    `;
    const syms = extractSymbols("hooks/crud.ts", src);
    const names = syms.map((s) => s.name);
    expect(names).toContain("useCrudResource");
    expect(names).toContain("refresh"); // nested useCallback — was the blind spot
    expect(names).toContain("create");
    expect(names).toContain("memod");
    const r = syms.find((s) => s.name === "refresh")!;
    expect(r.kind).toBe("function");
  });

  it("gives nested same-name consts distinct ids (line-suffixed)", () => {
    const src = `
      export function A() { const handler = useCallback(() => 1, []); return handler; }
      export function B() { const handler = useCallback(() => 2, []); return handler; }
    `;
    const syms = extractSymbols("lib/d.ts", src);
    const handlers = syms.filter((s) => s.name === "handler");
    expect(handlers.length).toBe(2);
    expect(handlers[0].id).not.toBe(handlers[1].id); // line suffix disambiguates
  });
});

describe("tokenize", () => {
  it("splits camelCase + snake_case and filters stop-words / short tokens", () => {
    expect(tokenize("processPayment")).toEqual(expect.arrayContaining(["process", "payment"]));
    expect(tokenize("is_active_v2")).toEqual(expect.arrayContaining(["active", "v2"]));
    // "use"/"get"/"set" are in STOP_NAMES; single chars dropped.
    expect(tokenize("use get set x")).toEqual([]);
  });
});

describe("bm25Doc", () => {
  it("weights name subtokens higher than summary tokens", () => {
    const s: Symbol = {
      id: "a:processPayment", name: "processPayment", kind: "function",
      file_path: "a.ts", startLine: 1, endLine: 2, inputs: [], outputs: "",
      summary: "handles payment processing", called_by: [], calls: [],
      file_hash: "x", code: "const processPayment = () => {}",
    };
    const d = bm25Doc(s);
    // "payment" comes from the name (weight 5) AND the summary (weight 2) → ≥5.
    expect(d.get("payment") ?? 0).toBeGreaterThanOrEqual(5);
  });
});

describe("rerank", () => {
  const mk = (name: string, summary = "", code = name): Symbol => ({
    id: `a:${name}`, name, kind: "function", file_path: "a.ts",
    startLine: 1, endLine: 2, inputs: [], outputs: "", summary,
    called_by: [], calls: [], file_hash: "x", code,
  });

  it("ranks exact name > name-prefix > summary-only overlap", () => {
    const exact = mk("refresh");
    const partial = mk("refreshData"); // name starts with / includes query
    const loose = mk("loader", "calls refresh internally");
    expect(rerank("refresh", exact)).toBeGreaterThan(rerank("refresh", partial));
    expect(rerank("refresh", partial)).toBeGreaterThan(rerank("refresh", loose));
  });
});

describe("recomputeCalledBy + calls", () => {
  it("populates outgoing (calls) and incoming (called_by) edges, no self-refs", () => {
    const alpha: Symbol = {
      id: "a.ts:alpha", name: "alpha", kind: "function", file_path: "a.ts",
      startLine: 1, endLine: 3, inputs: [], outputs: "",
      summary: "function alpha()", called_by: [], calls: [],
      file_hash: "x", code: "function alpha() { beta(); }",
    };
    const beta: Symbol = {
      id: "b.ts:beta", name: "beta", kind: "function", file_path: "b.ts",
      startLine: 1, endLine: 3, inputs: [], outputs: "",
      summary: "function beta()", called_by: [], calls: [],
      file_hash: "x", code: "function beta() { return 1; }",
    };
    recomputeCalledBy([alpha, beta]);
    // alpha's code references beta → alpha.calls includes beta; beta.called_by includes alpha.
    expect(alpha.calls).toContain("b.ts:beta");
    expect(beta.called_by).toContain("a.ts:alpha");
    expect(alpha.called_by).not.toContain("a.ts:alpha"); // no self-reference
    expect(beta.calls).not.toContain("b.ts:beta");
  });
});
