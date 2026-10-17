import { getPlatformMenuFlags } from "@/lib/platformMenuFlags";
import { redirect } from "next/navigation";

export default async function AdminApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const flags = await getPlatformMenuFlags();
  if (!flags.showWorkRequestsMenu) {
    redirect("/admin");
  }
  return children;
}
