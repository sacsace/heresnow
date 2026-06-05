import { requireActiveSubscription } from "@/lib/requireActiveSubscription";

export default async function EmployeeActiveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireActiveSubscription();
  return children;
}
