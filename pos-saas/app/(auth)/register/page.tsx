"use client";

import { useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { apiFetch, ApiClientError } from "@/modules/shared";
import { BrandMark } from "@/components/public/brand-logo";
import { GoogleIcon } from "@/components/auth/google-icon";
import { DynamicForm } from "@/lib/forms/dynamic-form";
import { registerSchema } from "@/lib/forms/schemas";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);

  // Pre-fill from Google OAuth redirect
  const googleEmail = searchParams.get("googleEmail") ?? "";
  const googleName = searchParams.get("googleName") ?? "";
  const googleId = searchParams.get("googleId") ?? "";
  const isGoogleFlow = !!googleId;
  // ?plan=growth|pro picks which tier to trial. Default: PRO (full features 14 days).
  const trialTier = searchParams.get("plan") === "growth" ? "GROWTH" : "PRO";
  // ?ref=CODE — referral code (optional). Reward unlocks on first paid payment.
  const referralCode = searchParams.get("ref") ?? "";

  // Override the agreeTerms field with a render that has a clickable T&C link.
  const registerSchemaWithLink = useMemo(
    () => ({
      ...registerSchema,
      fields: registerSchema.fields.map((f) =>
        f.name === "agreeTerms"
          ? {
              ...f,
              label: undefined,
              hint: undefined,
              render: ({ value, onChange, disabled }: { value: unknown; onChange: (v: unknown) => void; disabled?: boolean }) => (
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => onChange(e.target.checked)}
                    disabled={disabled}
                    className="h-4 w-4 rounded border-border"
                  />
                  <span>
                    Saya setuju dengan{" "}
                    <Link href="/terms" target="_blank" className="text-[var(--color-primary)] font-semibold hover:underline">
                      Syarat &amp; Ketentuan
                    </Link>{" "}
                    hivePOS
                  </span>
                </label>
              ),
            }
          : f,
      ),
    }),
    [],
  );

  async function handleRegister(values: Record<string, unknown>) {
    setLoading(true);
    try {
      // Auto-generate fields the user no longer fills manually.
      const businessName = String(values.businessName ?? "").trim();
      const slugBase = businessName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "laundry";
      const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;
      const ownerName = googleName || businessName;

      await apiFetch("/api/register", {
        method: "POST",
        body: {
          ...values,
          businessName,
          slug,
          branchName: "Outlet Pusat",
          ownerName,
          ownerPhone: "",
          trialTier,
          ...(referralCode ? { referralCode } : {}),
          ...(googleId ? { googleId } : {}),
        },
      });

      if (isGoogleFlow) {
        // Google flow: re-authenticate via Google OAuth → auto-login → dashboard.
        toast.success("Pendaftaran berhasil! Mengarahkan ke dashboard…");
        await signIn("google", { callbackUrl: "/dashboard" });
        return;
      }
      // Email flow: auto sign-in with credentials.
      const res = await signIn("credentials", {
        email: String(values.email),
        password: String(values.password ?? ""),
        redirect: false,
      });
      if (!res?.error) {
        toast.success("Pendaftaran berhasil! Mengarahkan ke dashboard…");
        router.push("/dashboard");
        return;
      }
      // Auto sign-in failed (rare) — fall back to manual login.
      toast.success("Pendaftaran berhasil! Akun langsung aktif — silakan masuk.");
      router.push("/login");
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pub-scope min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 font-black text-2xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white">
              <BrandMark className="h-6 w-6" />
            </span>
            hive<span className="text-[var(--color-primary)]">POS</span>
          </Link>
          <h1 className="text-3xl font-bold mt-6">Daftar Bisnis Laundry Anda</h1>
          <p className="text-[var(--color-muted-foreground)] mt-2">
            Gratis 1 outlet selamanya. Setup 2 menit, aktif langsung.
          </p>
        </div>

        {isGoogleFlow && (
          <div className="mb-6 p-4 rounded-xl border border-[var(--color-primary)] bg-[var(--color-primary)]/10 flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <p className="text-sm font-semibold">
              Akun Google terhubung: <span className="text-[var(--color-primary)]">{googleEmail}</span>
              <br />
              <span className="text-xs text-[var(--color-muted-foreground)]">Lengkapi data bisnis di bawah untuk menyelesaikan pendaftaran.</span>
            </p>
          </div>
        )}

        {process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true" && !isGoogleFlow && (
          <div className="mb-6">
            <button
              type="button"
              onClick={() => signIn("google", { callbackUrl: "/register" })}
              className="w-full py-3 rounded-xl border border-[var(--color-border)] font-semibold flex items-center justify-center gap-3 hover:bg-[var(--color-muted)] transition"
            >
              <GoogleIcon />
              Daftar dengan Google
            </button>
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[var(--color-background)] px-2 text-[var(--color-muted-foreground)]">
                  atau isi manual
                </span>
              </div>
            </div>
          </div>
        )}

        <DynamicForm
          schema={registerSchemaWithLink}
          initialData={{
            email: googleEmail,
            ownerName: googleName,
            googleId: googleId || undefined,
          }}
          onSubmit={handleRegister}
          disabled={loading}
          className={isGoogleFlow ? "[&_input[name=email]]:opacity-60 [&_input[name=email]]:pointer-events-none" : undefined}
        />

        <p className="text-center text-sm text-[var(--color-muted-foreground)] mt-6">
          Sudah punya akun?{" "}
          <Link href="/login" className="text-[var(--color-primary)] font-semibold hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p className="text-[var(--color-muted-foreground)]">Memuat...</p></div>}>
      <RegisterForm />
    </Suspense>
  );
}
