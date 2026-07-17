// One-off: migrate the hardcoded BLOG_POSTS (lib/blog-posts.ts) into the DB so
// the blog keeps its 5 existing SEO posts after switching to the CMS. Each post's
// structured sections are flattened to Markdown. Idempotent by slug.
//
//   npx tsx scripts/seed-blog.ts
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import "dotenv/config";
import { BLOG_POSTS } from "../lib/blog-posts";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL! });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

function sectionsToMarkdown(sections: { heading: string; body: string[] }[]): string {
  return sections
    .map((s) => `## ${s.heading}\n\n${s.body.join("\n\n")}`)
    .join("\n\n");
}

async function main() {
  const admin = await prisma.superAdmin.findUnique({ where: { email: "admin@possaas.id" } });
  if (!admin) {
    throw new Error("Super admin admin@possaas.id not found — run prisma/seed.ts first.");
  }

  let upserted = 0;
  for (const post of BLOG_POSTS) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: {
        title: post.title,
        description: post.description,
        keywords: post.keywords,
        content: sectionsToMarkdown(post.sections),
        published: true,
        publishedAt: new Date(post.publishedAt),
        authorId: admin.id,
      },
      create: {
        slug: post.slug,
        title: post.title,
        description: post.description,
        keywords: post.keywords,
        content: sectionsToMarkdown(post.sections),
        published: true,
        publishedAt: new Date(post.publishedAt),
        authorId: admin.id,
      },
    });
    upserted++;
    console.log(`  ✓ ${post.slug}`);
  }
  console.log(`Done. ${upserted} blog posts seeded.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
