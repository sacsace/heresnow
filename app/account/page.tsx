import { auth } from "@/auth";
import { AccountPageBody } from "@/components/account/AccountPageBody";
import { redirect } from "next/navigation";

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  return (
    <AccountPageBody
      email={session.user.email}
      role={session.user.role ?? "EMPLOYEE"}
    />
  );
}
