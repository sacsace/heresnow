import { redirect } from "next/navigation";

export default function EmployeeEarlyLeaveRedirectPage() {
  redirect("/employee/approvals");
}
