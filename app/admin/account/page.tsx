import { auth } from "@/auth";
import { AccountPageBody } from "@/components/account/AccountPageBody";
import { loadAccountEmployeeName } from "@/lib/loadAccountEmployeeName";
import { redirect } from "next/navigation";

export default async function AdminAccountPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const name = await loadAccountEmployeeName(session.user.id, session.user.employeeId);

  return (
    <AccountPageBody
      email={session.user.email}
      name={name}
      role={session.user.role ?? "EMPLOYEE"}
    />
  );
}
