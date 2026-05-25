import { AppShell } from "@/components/AppShell";
import { SuperNavBar } from "@/components/SuperNavBar";
import { requireConsent } from "@/lib/requireConsent";
import { appContainerSuper } from "@/lib/uiStyles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "슈퍼관리자", template: "%s | HeresNow 슈퍼관리자" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <AppShell header={<SuperNavBar />} bodyClassName={appContainerSuper}>
      {children}
    </AppShell>
  );
}
