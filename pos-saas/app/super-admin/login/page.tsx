"use client";

import { useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Shield } from "lucide-react";
import { BrandMark } from "@/components/public/brand-logo";
import { DynamicForm } from "@/lib/forms/dynamic-form";
import { superAdminLoginSchema } from "@/lib/forms/schemas";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  // Already-authenticated users don't belong on this page.
  useEffect(() => {
    if (status !== "authenticated") return;
    const role = (session?.user as any)?.role;
    if (role === "SUPER_ADMIN" || role === "SUPPORT") {
      router.replace("/super-admin");
    } else {
      router.replace("/dashboard");
    }
  }, [status, session, router]);

  async function handleLogin(values: Record<string, unknown>) {
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        scope: "super-admin", // gate — see lib/auth.ts authorize()
        remember: values.remember !== false,
        redirect: false,
      });

      if (result?.error) {
        toast.error("Kredensial platform staff tidak valid");
      } else {
        toast.success("Masuk panel super admin");
        router.push("/super-admin");
        router.refresh();
      }
    } catch {
      toast.error("Terjadi kesalahan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  // Don't render the form for already-authenticated users (avoid flash).
  if (status === "authenticated") return null;

  return (
    <div className="pub-scope min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link
            href="/super-admin/login"
            className="inline-flex items-center gap-2 font-black text-2xl"
            tabIndex={-1}
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 text-white shadow-lg shadow-indigo-600/25">
              <BrandMark className="h-6 w-6" />
            </span>
            hive<span className="text-[var(--color-primary)]">POS</span>
          </Link>
          <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-muted-foreground)]">
            <Shield className="h-3 w-3" />
            Platform Staff
          </div>
          <h1 className="text-2xl font-bold mt-6">Super Admin Panel</h1>
          <p className="text-[var(--color-muted-foreground)] mt-2">
            Akses terbatas — tim platform hivePOS
          </p>
        </div>

        <DynamicForm
          schema={superAdminLoginSchema}
          onSubmit={handleLogin}
          disabled={loading}
        />

        <div className="mt-6 text-center">
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Bukan staff platform?{" "}
            <Link
              href="/login"
              className="text-[var(--color-primary)] font-semibold hover:underline"
            >
              Masuk bisnis
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
