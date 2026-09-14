import { requireActiveSubscription } from "@/lib/requireActiveSubscription";

export default async function EmployeeApprovalsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActiveSubscription();
  return children;
}
