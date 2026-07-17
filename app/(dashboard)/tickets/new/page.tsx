"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { DynamicForm } from "@/lib/forms";
import { ticketFormSchema } from "@/lib/forms/schemas";
import { buttonVariants } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";

export default function NewTicketPage() {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/tickets" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          {t("tickets.back")}
        </Link>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <LifeBuoy className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t("tickets.submit")}</h1>
            <p className="text-sm text-muted-foreground">{t("tickets.descriptionPlaceholder")}</p>
          </div>
        </div>

        <DynamicForm
          schema={ticketFormSchema}
          onSuccess={(data) => {
            const id = (data as { id?: string }).id;
            router.push(id ? `/tickets/${id}` : "/tickets");
          }}
          onCancel={() => router.push("/tickets")}
        />
      </div>
    </div>
  );
}
