import { getServerSession } from "@/lib/getServerSession";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await getServerSession();
  if (!session?.user) redirect("/login");

  const { role } = session.user;

  if (role === "SUPER_ADMIN") redirect("/super");
  if (role === "DOOR") redirect("/door");
  if (role === "EMPLOYEE") redirect("/employee");
  if (role === "COMPANY_ADMIN" || role === "HR_MANAGER" || role === "APPROVER") {
    redirect("/admin");
  }

  redirect("/login");
}
