import { PublicNavbar } from "@/components/public/navbar";
import { PublicFooter } from "@/components/public/footer";
import { WhatsAppFAB } from "@/components/public/whatsapp-fab";

export default function PublicServiceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pub-scope min-h-screen">
      <PublicNavbar />
      <main>{children}</main>
      <PublicFooter />
      <WhatsAppFAB />
    </div>
  );
}
