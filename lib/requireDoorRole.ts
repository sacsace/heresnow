import { auth } from "@/auth";
import { isDoorRole } from "@/lib/doorAttendance";
import type { Session } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export async function requireDoorSession() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!isDoorRole(session.user.role)) redirect("/");
  if (!session.user.companyId) redirect("/login?session=invalid");
  return session;
}

export function doorApiForbidden(session: Session | null): NextResponse | null {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDoorRole(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.user.companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }
  return null;
}
