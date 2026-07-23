---
name: hivepos-feature
description: Contract-first feature flow for hivePOS. Use when starting ANY feature that touches both hivepos-api and hivepos-web. Enforces branch-per-feature, contract-PRD first, parallel isolated BE+FE agents binding to the contract, and merge-only-when-green. Prevents the cascading FE↔BE breakage caused by hand-written types diverging from the backend.
---

# /feature — contract-first feature flow

Use for any feature touching **both** the Go backend and the Next.js frontend. Goal: zero contract drift → zero cascading breakage. The contract (`hivepos-web/contracts/openapi.yaml`) is the shared spec both sides bind to.

## 1. Branch (off main, root repo)
```bash
git checkout main && git pull --ff-only
git checkout -b feat/<domain>-<thing>
```
One feature = one branch. Never commit WIP to main. (Model the behavior you want enforced everywhere.)

## 2. Contract-PRD FIRST (before any BE/FE code)
- Dispatch the **hivepos-contract** agent to add/update the endpoint(s) in `hivepos-web/contracts/openapi.yaml`. It reads the feature brief (or, for backfill, the existing BE DTOs) and writes the spec.
- Write `hivepos-web/docs/specs/<feature>.md` (Given/When/Then acceptance) from `_TEMPLATE.md`.
- Agent runs `npm run gen:contract` + `gen:contract:check` + `tsc` → must be clean.
- **Commit the contract + regenerated `types.ts` + `docs/contracts/*` together on the branch.** This commit lands FIRST, before feature code.

## 3. Parallel BE + FE in isolation (worktrees)
Dispatch BOTH in one message, each via the Agent tool with `isolation: "worktree"`:
- **hivepos-backend** → implements the Go route(s) against the contract. Gate: `go vet && go test && go build` + `curl` field-name check.
- **hivepos-frontend** → consumes the generated types via `apiFetch`. Gate: `tsc && build && test` + browser verify.

**Why worktrees:** this project's parallel-agent history has branches orphaning and the shared working tree reverting mid-session (see project memory). A worktree gives each agent an independent checkout so their builds/tests don't collide and nothing reverts under the other. Both read the SAME committed contract as the shared spec — neither invents fields.

## 4. Merge ONLY when green
All must pass before merge:
- BE gate (vet/test/build + curl JSON keys match contract).
- FE gate (tsc/build/test + contract round-trips — generated types still compile).
- Manual/browser verify on the changed path (`hivepos-web/docs/sop/qa-verification.md`).
- `gen:contract:check` still clean.

Then squash-merge to `main`, delete the branch. If any gate fails, fix **on the branch** — never merge broken WIP.

## When NOT to run the full flow
- Bug fix, typo, pure refactor, or single-repo change (BE-only or FE-only) — skip the ceremony; still branch + run that side's gate.
- The contract already covers the endpoint and only behavior changes — skip step 2's contract agent; still do 1, 3, 4.
- New endpoint with no FE yet — run steps 1-2 (contract) + backend (3), skip frontend; FE lands later consuming the generated type.
