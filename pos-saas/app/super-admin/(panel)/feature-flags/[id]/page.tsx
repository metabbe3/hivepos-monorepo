import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { FlagDetailManager } from "./flag-detail-manager";
import { DetailShell } from "@/components/super-admin";

export default async function FlagDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSuperAdminPanelSession();
  const { id } = await params;

  return (
    <div className="animate-fade-in-up">
      <DetailShell
        backHref="/super-admin/feature-flags"
        backLabel="All Flags"
        title="Flag Detail"
      >
        <FlagDetailManager flagId={id} />
      </DetailShell>
    </div>
  );
}
