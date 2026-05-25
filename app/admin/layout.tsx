import { AdminNavBar } from "@/components/AdminNavBar";
import { AppShell } from "@/components/AppShell";
import { requireConsent } from "@/lib/requireConsent";
import { appContainerAdmin } from "@/lib/uiStyles";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();

  return (
    <AppShell
      header={<AdminNavBar />}
      bodyClassName={appContainerAdmin}
      shellClassName="min-w-0 overflow-x-hidden pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      {children}
    </AppShell>
  );
}
