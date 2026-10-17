import { getPlatformMenuFlags } from "@/lib/platformMenuFlags";
import { redirect } from "next/navigation";

export default async function AdminBillingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const flags = await getPlatformMenuFlags();
  if (!flags.showBillingMenu) {
    redirect("/admin");
  }
  return children;
}
