# Preferences

The preferred way of working in this codebase. Read this before writing any code here.

## 1. Code style & lazy conventions (ponytail mode)

**Lazy senior dev ethos.** Lazy = efficient, not careless. Stop at the first rung that holds:

1. **Does this need to exist at all?** Speculative need → skip it, say so in one line. (YAGNI)
2. **Stdlib does it?** Use it.
3. **Native platform feature covers it?** `<input type="date">` over a picker lib. CSS over JS. DB constraint over app code.
4. **Already-installed dependency solves it?** Use it. Never add a new one for what a few lines can do.
5. **Can it be one line?** One line.
6. **Only then:** the minimum code that works.

**Rules:**
- **No unrequested abstraction.** Interface with one implementation = delete it. Factory for one product = delete it. Config for a value that never changes = inline it.
- **No boilerplate, no scaffolding "for later".** Later can scaffold for itself.
- **Deletion over addition.** Boring over clever. Fewest files wins. Shortest working diff wins.
- **Two stdlib options, same size?** Take the one correct on edge cases.
- **Trivial one-liners need no test.** YAGNI applies to tests too.
- **Non-trivial logic** (branch, loop, parser, money/security path) leaves ONE runnable check behind — smallest thing that fails if the logic breaks. No frameworks, no fixtures unless asked.
- **Pattern: `[code] → skipped: [X], add when [Y].`** Code first, then at most three short lines of explanation.

**Mark deliberate shortcuts** with a `ponytail:` comment naming the ceiling and upgrade path:

```typescript
// ponytail: global lock, per-account locks if throughput matters
const data = await cache.get(key);
```

```typescript
// ponytail: pending-first sort done in JS — saves a raw SQL orderBy.
// Pending = approvedAt === null. Add an indexed status column if list grows >10k.
```

**Regenerate the debt ledger** (entries collected in `PONYTAIL-DEBT.md`):
```bash
grep -rnE '(#|//) ?ponytail:' . \
  --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.next \
  --exclude-dir=coverage --exclude-dir=test-results
```

See `PONYTAIL-DEBT.md` for the current ledger and the convention's full rules.

## 2. What NOT to build

- **Don't add features, refactors, or "improvements" beyond what was asked.** A bug fix doesn't need surrounding cleanup. A simple feature doesn't need extra configurability.
- **Don't add docstrings, comments, or type annotations to code you didn't change.** Only comment where logic isn't self-evident.
- **Don't add error handling for impossible scenarios.** Trust internal code + framework guarantees. Validate only at trust boundaries (user input, external APIs).
- **Don't add feature flags or backwards-compatibility shims when you can just change the code.** Unused `_vars`, re-exports, `// removed` comments = delete, don't rename.
- **Don't design for hypothetical future requirements.** Three similar lines of code > premature abstraction.
- **Don't write tests for trivial getters / setters / render calls.**
- **Don't add a new dependency for what a few lines can do.**
- **No emojis in code/files unless explicitly requested.**
- **NEVER proactively create `*.md` documentation files.** This `docs/` suite is the explicit exception, requested by the user.
- **Avoid over-engineering.** The right amount of complexity is the minimum needed for the current task.

## 3. Definition of done

Before claiming a task is complete, verify:

- [ ] `npx tsc --noEmit` — green (0 errors)
- [ ] `npm run build` — green (route manifest includes any new routes)
- [ ] `npm test` — green (if tests exist or were touched)
- [ ] Every super-admin mutation has an `auditLog` row in the same `prisma.$transaction` with the right `action` string
- [ ] Every new user-facing string has **both** `en` and `id` entries in `lib/i18n.ts`
- [ ] Every new tenant-scoped query filters by `session.user.tenantId` (never trust client input)
- [ ] Every new feature flag is added to `FLAG_KEYS` in `lib/feature-flags.ts` AND to `prisma/seed-flags.ts` AND seeded into the DB
- [ ] Every new RBAC check has the resource declared in `lib/permissions/definitions.ts` (RESOURCES + RESOURCE_ACTIONS + RESOURCE_LABELS)
- [ ] Any deliberate shortcut has a `ponytail:` comment naming the ceiling + upgrade path
- [ ] No `_unused` vars, no `// removed` dead code, no TODOs left behind
- [ ] If touching `lib/auth.ts` jwt callback: feature flags resolve in all 3 login paths (credentials, Google OAuth, session refresh) + impersonation swap path
- [ ] If touching the sidebar: both `hasFlag(item.flag)` AND `can(item.resource, item.action)` checks remain in the filter
- [ ] **Ran `code-review` (or a reviewer subagent) on the diff and fixed findings** — every change is reviewed before "done" (see `docs/sop/qa-verification.md`)
- [ ] **Browser/Playwright-verified the changed path end-to-end** — not just "it compiles"
- [ ] **No nested `<form>` inside `<form>`** (inline sub-actions use `<div>` + `type="button"`)
- [ ] **Schema changed → rebuilt both `app` AND `init-db` Docker images**
- [ ] Checked `docs/lessons-learned.md` for a known gotcha that applies to this change

## 4. Git & commit conventions

### Commit format
Conventional commits:
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring without behavior change
- `docs:` — documentation
- `test:` — tests
- `chore:` — maintenance, deps, config

**Body focuses on WHY, not WHAT** — the diff shows what. Explain the motivation and any non-obvious trade-off.

**Co-author trailer** on AI-assisted commits:
```
Co-Authored-By: Claude <noreply@anthropic.com>
```

### Safety protocol
- **NEVER update git config** (user.name, user.email, etc.)
- **NEVER run destructive commands** (`push --force`, `hard reset`) unless the user explicitly requests them
- **NEVER skip hooks** (`--no-verify`, `--no-gpg-sign`) unless explicitly requested
- **NEVER force-push to main/master** — warn the user if they request it
- **NEVER commit** unless the user explicitly asks. Proactive commits feel invasive.
- **NEVER push** to remote unless explicitly asked.
- **NEVER amend** a pushed commit. Only amend an unpushed commit when ALL of: user asked, OR pre-commit hook auto-modified files, OR HEAD was created in this session.
- **NEVER use `-i` flag** (`rebase -i`, `add -i`) — interactive input isn't supported.
- **Don't commit** `.env`, credentials, `*.pem`, `coverage/`, `.next/`, `node_modules/`, `.playwright-mcp/`, `test-results/`.

### Branch naming
- `feat/<short-scope>` — e.g. `feat/feature-flags`
- `fix/<short-scope>` — e.g. `fix/sidebar-flag-filter`
- `docs/<short-scope>` — e.g. `docs/claude-md-suite`

### PR description
```markdown
## Summary
- 1-3 bullet points on what changed and why.

## Test plan
- [ ] Manual verification step 1
- [ ] Manual verification step 2
```
