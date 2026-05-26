import { AccountHeader } from "@/components/account/AccountHeader";
import { AppShell } from "@/components/AppShell";
import { requireConsent } from "@/lib/requireConsent";
import { appContainerEmployee } from "@/lib/uiStyles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "내 계정", template: "%s | HeresNow" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireConsent();

  return (
    <AppShell
      header={<AccountHeader />}
      bodyClassName={appContainerEmployee}
      shellClassName="min-w-0 overflow-x-hidden pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)]"
    >
      {children}
    </AppShell>
  );
}
