import { AdminChrome } from "@/components/admin/AdminChrome";
import { requireConsent } from "@/lib/requireConsent";
import { appContainerAdmin } from "@/lib/uiStyles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | HeresNow 관리자" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <AdminChrome bodyClassName={appContainerAdmin}>
      {children}
    </AdminChrome>
  );
}
