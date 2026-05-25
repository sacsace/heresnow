import { AppShell } from "@/components/AppShell";
import { SuperNavBar } from "@/components/SuperNavBar";
import { requireConsent } from "@/lib/requireConsent";
import { appContainerSuper } from "@/lib/uiStyles";

export default async function SuperLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <AppShell header={<SuperNavBar />} bodyClassName={appContainerSuper}>
      {children}
    </AppShell>
  );
}
