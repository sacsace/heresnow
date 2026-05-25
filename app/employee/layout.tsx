import { AppShell } from "@/components/AppShell";
import { EmployeeHeader } from "@/components/EmployeeHeader";
import { requireConsent } from "@/lib/requireConsent";
import { appContainerEmployee } from "@/lib/uiStyles";

export default async function EmployeeLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <AppShell
      header={<EmployeeHeader />}
      bodyClassName={appContainerEmployee}
      shellClassName="min-w-0 overflow-x-hidden pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      {children}
    </AppShell>
  );
}
