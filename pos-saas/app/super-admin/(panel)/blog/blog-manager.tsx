"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { toast } from "sonner";
import { useConfirm } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface BlogPostListItem {
  id: string;
  slug: string;
  title: string;
  description: string;
  coverImage: string | null;
  published: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

const EMPTY = {
  id: null as string | null,
  title: "",
  slug: "",
  description: "",
  keywords: "",
  coverImage: "",
  content: "",
  published: false,
};

function slugify(s: string): string {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

// ponytail: live preview in a sandboxed iframe — sandbox="" blocks script
// execution so the author's own Markdown can't XSS the panel, and it keeps
// dangerouslySetInnerHTML out of the client. Published render (server) is
// sanitized in lib/blog/render.ts.
const PREVIEW_SHELL = (inner: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><style>` +
  `body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#334155;padding:14px;font-size:14px;line-height:1.65}` +
  `h1,h2,h3,h4{color:#0f172a;line-height:1.25}h1{font-size:1.4rem}h2{font-size:1.15rem;margin:.8em 0 .3em}h3{font-size:1rem}` +
  `a{color:#2563eb}img{max-width:100%;border-radius:6px}ul,ol{padding-left:1.3em}code{background:#f1f5f9;padding:1px 5px;border-radius:3px;font-size:.9em}` +
  `blockquote{border-left:3px solid #e2e8f0;margin:0;padding:.2em 0 .2em 1em;color:#64748b}` +
  `</style></head><body>${inner}</body></html>`;

export function BlogManager() {
  const [posts, setPosts] = useState<BlogPostListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [slugTouched, setSlugTouched] = useState(false);
  const confirm = useConfirm();

  const fetchPosts = useCallback(() => {
    setLoading(true);
    apiFetch<{ posts: BlogPostListItem[] }>("/api/super-admin/blog")
      .then((r) => setPosts(r.data?.posts ?? []))
      .catch((err) => toast.error(err instanceof ApiClientError ? err.message : "Gagal memuat blog."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const previewSrcDoc = useMemo(() => {
    try {
      return PREVIEW_SHELL(marked.parse(form.content || "") as string);
    } catch {
      return PREVIEW_SHELL("");
    }
  }, [form.content]);

  function openNew() {
    setForm({ ...EMPTY });
    setSlugTouched(false);
    setOpen(true);
  }

  async function openEdit(p: BlogPostListItem) {
    try {
      const res = await apiFetch<{ post: any }>(`/api/super-admin/blog/${p.id}`);
      const post = res.data?.post;
      if (!post) return;
      setForm({
        id: post.id,
        title: post.title,
        slug: post.slug,
        description: post.description,
        keywords: post.keywords ?? "",
        coverImage: post.coverImage ?? "",
        content: post.content,
        published: post.published,
      });
      setSlugTouched(true);
      setOpen(true);
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal memuat post.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      toast.error("Judul dan konten wajib diisi.");
      return;
    }
    setSaving(true);
    const body = {
      title: form.title,
      slug: form.slug || slugify(form.title),
      description: form.description,
      keywords: form.keywords,
      coverImage: form.coverImage,
      content: form.content,
      published: form.published,
    };
    try {
      if (form.id) {
        await apiFetch(`/api/super-admin/blog/${form.id}`, { method: "PATCH", body });
        toast.success("Post diperbarui.");
      } else {
        await apiFetch(`/api/super-admin/blog`, { method: "POST", body });
        toast.success("Post dibuat.");
      }
      setOpen(false);
      fetchPosts();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: BlogPostListItem) {
    if (
      !(await confirm({
        title: "Hapus post?",
        description: `Hapus "${p.title}"? Tidak bisa dibatalkan.`,
        destructive: true,
      }))
    )
      return;
    try {
      await apiFetch(`/api/super-admin/blog/${p.id}`, { method: "DELETE" });
      toast.success("Post dihapus.");
      fetchPosts();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal menghapus.");
    }
  }

  if (loading) return <p className="p-6 text-muted-foreground">Memuat…</p>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Blog</h1>
          <p className="text-sm text-muted-foreground">Tulis &amp; publikasi artikel SEO (Markdown).</p>
        </div>
        <Button onClick={openNew} className="bg-brand-600 hover:bg-brand-700 text-white">
          <Plus className="mr-1 h-4 w-4" /> Post Baru
        </Button>
      </div>

      <div className="space-y-2">
        {posts.length === 0 && <p className="text-sm text-muted-foreground">Belum ada post.</p>}
        {posts.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium truncate">{p.title}</span>
                  {p.published ? (
                    <Badge className="bg-emerald-100 text-emerald-700">Published</Badge>
                  ) : (
                    <Badge variant="secondary">Draft</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">/blog/{p.slug}</p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {p.published && (
                  <Link
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Lihat post"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(p)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive"
                  onClick={() => handleDelete(p)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Edit Post" : "Post Baru"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Judul</Label>
                <Input
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
                  }}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((f) => ({ ...f, slug: e.target.value }));
                  }}
                  placeholder="otomatis-dari-judul"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Deskripsi (meta description)</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Keywords (koma)</Label>
                <Input
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="kasir laundry, software laundry"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Cover image URL</Label>
                <Input
                  value={form.coverImage}
                  onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
                  placeholder="https://…"
                />
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Konten (Markdown)</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  className="min-h-[360px] font-mono text-sm"
                  placeholder={"## Judul Section\n\nTulis di sini…\n\n- poin\n- poin"}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preview</Label>
                <iframe
                  sandbox=""
                  title="Markdown preview"
                  className="min-h-[360px] w-full rounded-md border bg-white"
                  srcDoc={previewSrcDoc}
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm({ ...form, published: e.target.checked })}
                className="h-4 w-4 rounded border-border"
              />
              Publikasikan (tampil di /blog)
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Batal
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-brand-600 hover:bg-brand-700 text-white"
              >
                {saving ? "Menyimpan…" : "Simpan"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
