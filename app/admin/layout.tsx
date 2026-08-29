import { AdminChrome } from "@/components/admin/AdminChrome";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireConsent } from "@/lib/requireConsent";
import { isSubscriptionExpired } from "@/lib/subscriptionAccess";
import { appContainerAdmin } from "@/lib/uiStyles";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "관리자", template: "%s | HeresNow 관리자" },
  robots: { index: false, follow: false, nocache: true },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireConsent();
  const session = await auth();

  let subscriptionExpired = false;
  const companyId = session?.user?.companyId;
  if (companyId) {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { subscriptionEndsAt: true },
    });
    subscriptionExpired = isSubscriptionExpired(company?.subscriptionEndsAt ?? null);
  }

  return (
    <AdminChrome bodyClassName={appContainerAdmin} subscriptionExpired={subscriptionExpired}>
      {children}
    </AdminChrome>
  );
}
