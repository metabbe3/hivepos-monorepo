import { prisma } from "@/lib/prisma";
import {
  withErrorHandler,
  apiSuccess,
  apiCreated,
  ValidationError,
  ConflictError,
} from "@/modules/shared";
import { assertSuperAdminOrThrow } from "@/lib/super-admin/permissions";
import { auditLog } from "@/lib/audit";

const SLUG_RX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET — list all posts (incl. drafts) for the manager table
export const GET = withErrorHandler(async () => {
  await assertSuperAdminOrThrow();
  const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" } });
  return apiSuccess({
    posts: posts.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      description: p.description,
      coverImage: p.coverImage,
      published: p.published,
      publishedAt: p.publishedAt?.toISOString() ?? null,
      updatedAt: p.updatedAt.toISOString(),
    })),
  });
});

// POST — create a new post (draft or published)
export const POST = withErrorHandler(async (req: Request) => {
  const { session } = await assertSuperAdminOrThrow("SUPER_ADMIN");
  const actor = { id: session.user.id!, email: session.user.email! };
  const body = await req.json();

  const title = typeof body?.title === "string" ? body.title.trim() : "";
  if (!title) throw new ValidationError("Judul wajib diisi.");
  const content = typeof body?.content === "string" ? body.content : "";
  if (!content.trim()) throw new ValidationError("Konten tidak boleh kosong.");

  const slug = (typeof body?.slug === "string" && body.slug.trim()) || slugify(title);
  if (!SLUG_RX.test(slug)) {
    throw new ValidationError("Slug hanya boleh huruf kecil, angka, dan tanda hubung.");
  }
  const existing = await prisma.blogPost.findUnique({ where: { slug } });
  if (existing) throw new ConflictError("Slug sudah dipakai.");

  const published = body?.published === true;
  const publishedAt = published
    ? body?.publishedAt
      ? new Date(body.publishedAt)
      : new Date()
    : null;

  const created = await prisma.$transaction(async (tx) => {
    const post = await tx.blogPost.create({
      data: {
        slug,
        title,
        description: typeof body?.description === "string" ? body.description.trim() : "",
        keywords:
          typeof body?.keywords === "string" && body.keywords.trim() ? body.keywords.trim() : null,
        content,
        coverImage:
          typeof body?.coverImage === "string" && body.coverImage.trim()
            ? body.coverImage.trim()
            : null,
        published,
        publishedAt,
        authorId: actor.id,
      },
    });
    await auditLog(tx, {
      actor,
      action: "blog.create",
      target: { type: "BlogPost", id: post.id },
      diff: { slug, title, published },
      req,
    });
    return post;
  });

  return apiCreated({ post: { id: created.id, slug: created.slug } });
});
