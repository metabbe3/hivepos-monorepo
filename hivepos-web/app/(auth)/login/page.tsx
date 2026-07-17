"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, reloadSession } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { setAuthToken } from "@/lib/api/token";
import Link from "next/link";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";
import { BrandMark } from "@/components/public/brand-logo";
import { GoogleIcon } from "@/components/auth/google-icon";
import { DynamicForm } from "@/lib/forms/dynamic-form";
import { loginSchema } from "@/lib/forms/schemas";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [initialEmail, setInitialEmail] = useState("");

  const errorCode = searchParams.get("error");
  const banner = errorBanner(errorCode);

  // Pre-fill email from localStorage if "remember me" was previously checked.
  useEffect(() => {
    const saved = localStorage.getItem("hivepos_remember_email");
    if (saved) setInitialEmail(saved);
  }, []);

  // Land the Google OAuth round-trip: backend redirects here with ?googleToken=<jwt>.
  useEffect(() => {
    const t = searchParams.get("googleToken");
    if (!t) return;
    setAuthToken(t);
    reloadSession().then(() => router.replace("/dashboard"));
  }, [searchParams, router]);

  async function handleLogin(values: Record<string, unknown>) {
    setLoading(true);
    try {
      const remember = values.remember !== false;

      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        remember,
        redirect: false,
      });

      if (result?.error && errorBanner(result.error)) {
        window.location.href = `/login?error=${result.error}`;
      } else if (result?.error) {
        toast.error("Email atau password salah");
      } else {
        // Save/clear remembered email (NOT password — security).
        if (remember) {
          localStorage.setItem("hivepos_remember_email", String(values.email ?? ""));
        } else {
          localStorage.removeItem("hivepos_remember_email");
        }
        toast.success("Berhasil masuk!");
        router.push("/dashboard");
        router.refresh();
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pub-scope min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 font-black text-2xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
              <BrandMark className="h-6 w-6" />
            </span>
            hive<span className="text-[var(--color-primary)]">POS</span>
          </Link>
          <h1 className="text-2xl font-bold mt-6">Masuk ke Dashboard</h1>
          <p className="text-[var(--color-muted-foreground)] mt-2">Selamat datang kembali</p>
        </div>

        {banner && (
          <div
            role="alert"
            className="mb-4 flex gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="font-bold text-amber-900">{banner.title}</p>
              <p className="text-amber-800">{banner.body}</p>
            </div>
          </div>
        )}

        <DynamicForm schema={loginSchema} onSubmit={handleLogin} disabled={loading} initialData={initialEmail ? { email: initialEmail, remember: true } : undefined} />

        {/* Google OAuth — shows only if configured */}
        {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true" && (
          <>
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--color-background)] px-2 text-[var(--color-muted-foreground)]">
                  atau
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              className="w-full h-11 rounded-xl border border-[var(--color-border)] font-semibold flex items-center justify-center gap-3 hover:bg-[var(--color-muted)] transition"
            >
              <GoogleIcon />
              Masuk dengan Google
            </button>
          </>
        )}

        <div className="mt-6 space-y-2 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Belum punya akun?{" "}
            <Link href="/register" className="text-[var(--color-primary)] font-semibold hover:underline">
              Daftar bisnis baru
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

// ponytail: maps Auth.js error codes to Indonesian banner copy.
// Add codes here as new failure modes surface; keep the default
// short and actionable ("retry or use password").
function errorBanner(code: string | null):
  | { title: string; body: string }
  | null {
  if (!code) return null;
  switch (code) {
    case "google-link-required":
      return {
        title: "Akun ini terdaftar dengan password",
        body: "Email ini sudah punya akun hivePOS. Masuk dulu dengan password Anda, lalu hubungkan Google dari menu Profil.",
      };
    case "pending-approval":
      return {
        title: "Akun menunggu persetujuan",
        body: "Pendaftaran Anda sedang ditinjau admin. Coba lagi nanti.",
      };
    case "Configuration":
    case "AccessDenied":
    case "OAuthCallback":
    case "OAuthCallbackError":
      return {
        title: "Login Google gagal",
        body: "Coba lagi, atau masuk dengan password Anda.",
      };
    default:
      return null;
  }
}
