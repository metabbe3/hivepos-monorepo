import type { Metadata, ResolvingMetadata } from "next";

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata
): Promise<Metadata> {
  const { orderNumber } = await params;

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_BASE_URL || "https://hivepos.id"}/api/track/${orderNumber}`,
      { next: { revalidate: 60 } }
    );
    if (!res.ok) throw new Error("not found");
    const data = await res.json();

    const statusLabels: Record<string, string> = {
      RECEIVED: "Diterima",
      IN_PROGRESS: "Sedang Diproses",
      READY: "Siap Diambil",
      DELIVERED: "Selesai",
    };
    const statusLabel = statusLabels[data.status] || data.status;
    const branchName = data.branch?.name || "hivePOS";
    const total = new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
    }).format(data.totalAmount - (data.discountAmount || 0));

    const title = `${orderNumber} — ${statusLabel}`;
    const description = `${branchName} | ${data.customerName} | ${total} | ${statusLabel}`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        url: `https://hivepos.id/track/${orderNumber}`,
        siteName: branchName,
      },
      twitter: {
        card: "summary",
        title,
        description,
      },
    };
  } catch {
    return {
      title: "Lacak Pesanan",
      description: "Lacak status pesanan laundry kamu",
    };
  }
}

export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
