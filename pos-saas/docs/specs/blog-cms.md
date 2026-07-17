# Feature Spec — Super-admin Blog CMS (Markdown, DB-backed, SEO)

> **Status:** Draft · **Last updated:** 2026-07-03
> **Related code:** `prisma/schema.prisma`, `app/api/super-admin/blog/*`, `app/super-admin/(panel)/blog/*`, `app/blog/*`, `app/sitemap.ts`, `lib/blog/render.ts`

## 1. Overview & Problem
Blog posts are hardcoded (`lib/blog-posts.ts`), so every new SEO/long-tail article needs a code change + image rebuild. Goal: a super-admin CMS — author posts (Markdown + live preview), publish weekly with **no rebuild**.

## 2. Users & User Stories
- As a **super-admin**, I want to **create/edit Markdown blog posts** (with live preview) and **publish** them, so I can ship SEO content weekly without a deploy.
- As a **visitor**, newly published posts appear on `/blog` (+ sitemap) within ~10 min.

## 3. Scope
**In:** `BlogPost` model (DB); super-admin CRUD (Markdown editor + live preview + publish toggle); public blog reads from DB with ISR (`revalidate=600`); Markdown→HTML render; sitemap from DB; migrate the 5 existing posts.
**Out:** image upload (external URLs only for now); comments/categories; multi-author; draft preview link.

## 4. Functional Requirements
- **FR-1** `BlogPost { slug @unique, title, description, keywords?, content(Markdown), coverImage?(URL), published, publishedAt?, authorId→SuperAdmin, timestamps }`.
- **FR-2** Super-admin API: `GET /api/super-admin/blog` (list, incl. drafts), `POST` (create), `GET/PATCH/DELETE /api/super-admin/blog/[id]`. `assertSuperAdminOrThrow("SUPER_ADMIN")` + `auditLog` (`blog.create/update/delete`) (Non-negotiable #2). Slug uniqueness enforced.
- **FR-3** Editor: Markdown textarea + live rendered preview (client `marked`); fields title/slug(auto from title, editable)/description/keywords/coverImage URL/publish toggle.
- **FR-4** Public `/blog` + `/blog/[slug]`: DB fetch of `published && publishedAt <= now`; `revalidate=600` (ISR) + `dynamicParams=true` + `generateStaticParams` from DB; `generateMetadata` (title/desc/keywords/openGraph article) + JSON-LD `Article`.
- **FR-5** `renderMarkdown` (server `marked` + light sanitize: strip `<script>`, `on*=` handlers, `javascript:` hrefs) + `estimateReadTime` (words/200).
- **FR-6** Sitemap lists published posts from DB (immediate; it's `force-dynamic`).

## 5. Non-Functional
- One dep: `marked`. One-time rebuild (schema + dep); thereafter publishing is data-only (ISR).
- Trusted-author model (super-admin only) + light sanitize; DOMPurify if untrusted authors ever.
- SEO: semantic HTML from Markdown, per-post metadata + JSON-LD, sitemap, ISR for freshness.

## 6. Data Model
`BlogPost` (+ `blogPosts BlogPost[]` back-relation on `SuperAdmin`). `@@index([published, publishedAt])`.

## 7. API Surface
- `POST/GET /api/super-admin/blog`, `GET/PATCH/DELETE /api/super-admin/blog/[id]`.
- `/super-admin/blog` (manager UI); sidebar item in Operations.

## 8. Acceptance Criteria
- **AC-1** The 5 existing posts migrate to DB (seed) and render identically on `/blog` + `/blog/[slug]` with correct metadata + JSON-LD.
- **AC-2** Super-admin creates a Markdown post (sees live preview) → publishes → within ~10 min it appears on `/blog`, its slug page, and the sitemap **without a rebuild**.
- **AC-3** Editing a published post reflects within ~10 min (ISR).
- **AC-4** A draft (`published:false`) is not visible publicly.
- **AC-5** Audit log records create/update/delete.

## 9. Relations
| Function | Relation | Touchpoint |
|---|---|---|
| Super-admin CRUD | mirror | `app/api/super-admin/plans/*` + `plans-manager.tsx` |
| Auth/audit | `assertSuperAdminOrThrow` + `auditLog` | `lib/super-admin/permissions.ts`, `lib/audit.ts` |
| Markdown render | new | `lib/blog/render.ts` |

## 10. Test Plan
Manual on :3007 (rebuild both images): AC-1..AC-5. `npx tsc --noEmit` + `npm run build`.

## 11. Rollout
Schema + `marked` → `db:push` + `prisma generate` + rebuild both. Additive model; rollback = re-point blog pages to the old hardcoded lib.

## 13. Risks
- ISR delay (~10 min) for new posts — acceptable for weekly cadence; sitemap is immediate.
- Markdown XSS — mitigated by trusted authors + light sanitize.
