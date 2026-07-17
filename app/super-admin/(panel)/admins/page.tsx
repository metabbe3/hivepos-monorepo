"use client";

import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { apiFetch } from "@/modules/shared";
import { useSession } from "@/lib/auth-client";
import { AdminsManager } from "./admins-manager";
import { PageHeader } from "@/components/super-admin";

interface AdminRow {
  id: string;
  email: string;
  name: string;
  role: "SUPER_ADMIN" | "SUPPORT";
  createdAt: string;
}

export default function AdminsPage() {
  const { data: session } = useSession();
  const [admins, setAdmins] = useState<AdminRow[]>([]);

  const reload = useCallback(() => {
    apiFetch<AdminRow[]>("/api/super-admin/admins")
      .then(({ data }) => setAdmins(Array.isArray(data) ? data : []))
      .catch(() => setAdmins([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="animate-fade-in-up">
      <PageHeader
        eyebrow="Operations"
        title="Admin Accounts"
        subtitle="Who has access to this panel."
        icon={ShieldCheck}
      />

      <AdminsManager admins={admins} currentAdminId={(session?.user?.id as string) ?? ""} onMutated={reload} />
    </div>
  );
}
