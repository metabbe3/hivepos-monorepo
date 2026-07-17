import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  ValidationError,
  ConflictError,
  NotFoundError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// GET — one post (full content, for the editor)
export const GET = withErrorHandler(async (_req, ctx) => {
  await assertSuperAdminOrThrow();
  const { id } = await ctx!.params;
  const post = await prisma.blogPost.findUnique({ where: { id } });
  if (!post) throw new NotFoundError("BlogPost", id);
  return apiSuccess({
    post: {
      ...post,
      publishedAt: post.publishedAt?.toISOString() ?? null,
      createdAt: post.createdAt.toISOString(),
      updatedAt: post.updatedAt.toISOString(),
    },
  });
});

// PATCH — edit fields; slug uniqueness checked; first publish stamps publishedAt
export const PATCH = withErrorHandler(async (req, ctx) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };
  const { id } = await ctx!.params;
  const body = await req.json();

  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("BlogPost", id);

  const data: Record<string, unknown> = {};
  if (typeof body?.title === "string") data.title = body.title.trim();
  if (typeof body?.description === "string") data.description = body.description.trim();
  if (typeof body?.keywords === "string") data.keywords = body.keywords.trim() || null;
  if (typeof body?.content === "string") data.content = body.content;
  if (typeof body?.coverImage === "string") data.coverImage = body.coverImage.trim() || null;
  if (typeof body?.slug === "string" && body.slug.trim()) {
    const slug = body.slug.trim();
    if (!SLUG_RX.test(slug)) throw new ValidationError("Slug tidak valid.");
    if (slug !== existing.slug) {
      const taken = await prisma.blogPost.findUnique({ where: { slug } });
      if (taken) throw new ConflictError("Slug sudah dipakai.");
    }
    data.slug = slug;
  }
  if (typeof body?.published === "boolean") {
    data.published = body.published;
    if (body.published && !existing.publishedAt) data.publishedAt = new Date();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.update({ where: { id }, data });
    await auditLog(tx, {
      actor,
      action: "blog.update",
      target: { type: "BlogPost", id },
      diff: data,
      req,
    });
    return post;
  });

  return apiSuccess({ post: { id: updated.id, slug: updated.slug } });
});

// DELETE — remove a post
export const DELETE = withErrorHandler(async (req, ctx) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };
  const { id } = await ctx!.params;

  const existing = await prisma.blogPost.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("BlogPost", id);

  await prisma.$transaction(async (tx) => {
    await tx.blogPost.delete({ where: { id } });
    await auditLog(tx, {
      actor,
      action: "blog.delete",
      target: { type: "BlogPost", id },
      diff: { slug: existing.slug, title: existing.title },
      req,
    });
  });

  return apiSuccess({ deleted: id });
});
