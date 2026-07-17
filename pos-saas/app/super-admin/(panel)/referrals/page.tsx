import { requireSuperAdminPanelSession } from "@/lib/super-admin/permissions";
import { ReferralsManager } from "./referrals-manager";

export const metadata = { title: "Referrals — hivePOS Panel" };

export default async function ReferralsPage() {
  await requireSuperAdminPanelSession();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Referrals</h1>
        <p className="text-sm text-muted-foreground">
          Tenant referral ledger. A reward (1 free outlet-month, both sides) unlocks only when
          the referred tenant makes their first real paid payment. Void suspicious entries.
        </p>
      </div>
      <ReferralsManager />
    </div>
  );
}
