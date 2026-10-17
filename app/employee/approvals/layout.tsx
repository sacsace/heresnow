import { getPlatformMenuFlags } from "@/lib/platformMenuFlags";
import { redirect } from "next/navigation";

export default async function EmployeeApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const flags = await getPlatformMenuFlags();
  if (!flags.showWorkRequestsMenu) {
    redirect("/employee");
  }
  return children;
}
