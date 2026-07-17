import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PickupRequestForm } from "@/components/public/pickup-request-form";
import type { TemplateOverrides } from "@/lib/whatsapp-templates";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ branchSlug: string }>;
}

/** Shape we expect from Branch.pickupSlots JSON. */
type SlotDay = {
  day?: string;
  slots?: string[];
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { branchSlug } = await params;
  const branch = await prisma.branch.findFirst({
    where: { slug: branchSlug, isActive: true },
    select: { name: true },
  });
  return {
    title: branch
      ? `Pickup Request — ${branch.name}`
      : "Pickup Request",
    description: "Ajukan permintaan pickup laundry dari outlet kami.",
  };
}

export default async function PickupRequestPage({ params }: Props) {
  const { branchSlug } = await params;

  const branch = await prisma.branch.findFirst({
    where: { slug: branchSlug, isActive: true },
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      whatsappLink: true,
      pickupSlots: true,
      tenant: { select: { settings: true } },
    },
  });

  if (!branch || !branch.slug) {
    notFound();
  }

  const whatsappTemplates: TemplateOverrides =
    ((branch.tenant.settings as { whatsappTemplates?: TemplateOverrides } | null)?.whatsappTemplates) ?? {};

  // pickupSlots is stored as JSON; normalize defensively.
  let slotDays: SlotDay[] = [];
  if (Array.isArray(branch.pickupSlots)) {
    slotDays = branch.pickupSlots as SlotDay[];
  }

  return (
    <main className="px-5 sm:px-8 py-16 sm:py-20 bg-white min-h-screen">
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-brand/5 px-4 py-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand">
              Pickup
            </span>
          </div>
          <h1 className="mt-4 font-serif text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground">
            Antar Jemput Laundry
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {branch.name} — isi formulir, kami akan menjemput cucian Anda.
          </p>
        </header>

        <PickupRequestForm
          branchSlug={branch.slug}
          branchName={branch.name}
          branchAddress={branch.address ?? null}
          branchWhatsappLink={branch.whatsappLink ?? null}
          slotDays={slotDays}
          whatsappTemplates={whatsappTemplates}
        />
      </div>
    </main>
  );
}
