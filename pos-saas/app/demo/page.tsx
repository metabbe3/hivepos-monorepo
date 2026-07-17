"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Sparkles, ArrowRight } from "lucide-react";
import { BrandMark } from "@/components/public/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { toast } from "sonner";

// Email-gated sandbox demo. POST /api/demo/start provisions an isolated,
// pre-seeded tenant → returns synthetic demo-user creds → auto sign-in → /dashboard.
// No password typing, no real signup. See docs/specs/sandbox-demo.md.
// ponytail: copy is hardcoded Indonesian (no I18nProvider at the root layout) —
// matches the login/register sibling pages. The in-app demo banner uses t().
export default function DemoPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  async function startDemo(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiFetch<{ email: string; password: string }>("/api/demo/start", {
        method: "POST",
        body: { email: email.trim() || undefined },
      });
      const result = await signIn("credentials", {
        email: res.data.email,
        password: res.data.password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Gagal masuk ke demo. Coba lagi.");
        setLoading(false);
        return;
      }
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Gagal memulai demo. Coba lagi.");
      setLoading(false);
    }
  }

  return (
    <div className="pub-scope min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 font-black text-2xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-600/25">
              <BrandMark className="h-6 w-6" />
            </span>
            hive<span className="text-[var(--color-primary)]">POS</span>
          </Link>
          <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" /> Tanpa daftar · tanpa kartu kredit
          </div>
          <h1 className="text-3xl font-bold mt-4">Coba hivePOS tanpa daftar</h1>
          <p className="text-[var(--color-muted-foreground)] mt-2">
            Eksplorasi semua fitur dengan data contoh. Tanpa kartu kredit — data demo dihapus otomatis.
          </p>
        </div>

        <form onSubmit={startDemo} className="space-y-4">
          <div className="space-y-2">
            <Label>Email (opsional — untuk info saja)</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="kamu@email.com"
            />
          </div>
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-gradient-to-r from-indigo-500 to-indigo-700 font-semibold text-white shadow-md shadow-indigo-600/15"
          >
            {loading ? (
              "Menyiapkan demo…"
            ) : (
              <>
                Mulai Demo
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
          <Link href="/register" className="text-[var(--color-primary)] font-semibold hover:underline">
            Buat akun saya sendiri
          </Link>
        </p>
      </div>
    </div>
  );
}
