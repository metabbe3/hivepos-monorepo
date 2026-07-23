---
name: hivepos-debug
description: Token-cheap debugging for hivePOS. Use when chasing a bug, error string, log line, or unexpected behavior. Checks the known-pitfalls list FIRST (lessons-learned + non-negotiables), then locates source via codebase-rag debug/symbol/callers/callees + LSP — avoids the expensive read-many-files pattern. Terse output.
---

# /debug — codebase-aware, token-cheap debugging

Goal: root-cause with minimal file-reading. Most hivePOS bugs are repeats of known pitfalls — check those FIRST, then locate source with the index, not grep-spam.

## 1. Match against known pitfalls FIRST
Before exploring, check the symptom against these recurring hivePOS bugs:
- **FE↔BE field-name mismatch** (e.g. `snapToken` vs `token`) — `curl` the endpoint, compare JSON keys to what the FE reads. (web non-neg #9-10, lessons #2-3)
- **Wrong list shape** — bare array vs `writeRows` (`r.data.rows`). (web #9)
- **`apiFetch` in a server component** → SSR crash (reads localStorage). Convert to `"use client"`. (web #10)
- **No `mounted` guard** on a session/role page → hydration mismatch. (web #11)
- **`router.refresh()` didn't update useState** — it can't. Use a reload callback (`onMutated`). (web #12)
- **Valid session logged out by a blip** — `reloadSession` cleared the token on a non-401/403. Only clear on real 401/403. (web #13)
- **Fix shipped but browser serves old chunks** — service-worker cache not versioned per build. Unregister SW + clear caches. (web #14)
- **404/405 the unit tests miss** — route exists in code but method/path wrong. Click the button. (api #13)
- **Hardcoded price/config** drifting from the Plan table. (api #11)

Full detail: `hivepos-web/docs/lessons-learned.md`, `hivepos-api/docs/lessons-learned.md`, both `CLAUDE.md` non-negotiables.

## 2. Locate source (RAG first — no grep-spam, no file-dumping)
From the relevant repo:
- **Error/log/i18n string?** `codebase-rag debug "<text>"` → file:line of the literal. Cheapest possible locator.
- **Symbol / definition?** `codebase-rag symbol <Name>` (exact) or `query "<term>"` (fuzzy BM25).
- **Callers / callees?** `codebase-rag callers <Name>` / `callees <Name>`.
- **Need type-aware precision** (cross-file refs, hover types)? Then the LSP tool (`goToDefinition`, `findReferences`, `hover`).

Commands:
- Go: `cd hivepos-api && go run scripts/codebase-rag.go <cmd> "<arg>"`
- TS:  `cd hivepos-web && npx tsx scripts/codebase-rag.ts <cmd> "<arg>"`

## 3. Propose the minimal fix
Root-cause → smallest fix that resolves it → note if it's a known-pitfall recurrence (add a regression line to the relevant `lessons-learned.md`). Terse output.

## Don't
- Don't read 5 files to "understand" — RAG/LSP first.
- Don't paper over a contract drift; surface it — it's a real bug the contract exposes.
