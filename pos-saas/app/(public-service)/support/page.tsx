import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SupportTicketForm } from "@/components/public/support-ticket-form";

export const metadata: Metadata = {
  title: "Support — hivePOS",
  description: "Submit a support request.",
};

export default async function SupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Logged-in tenant users get the full in-app ticket flow (prefilled, threaded replies, CSAT).
  const session = await auth();
  if (session?.user?.id && session.user.role !== "SUPER_ADMIN") {
    redirect("/tickets/new");
  }

  const sp = await searchParams;
  const tenantSlug =
    typeof sp.tenant === "string" ? sp.tenant.slice(0, 80) : "";

  return (
    <main className="px-5 sm:px-8 py-16 sm:py-20 bg-white min-h-screen">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-extrabold tracking-tight">
            How can we help?
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Tell us what&apos;s going on and our team will get back to you by email.
          </p>
        </header>
        <SupportTicketForm tenantSlug={tenantSlug} />
      </div>
    </main>
  );
}
