import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/** 플랫폼 root SUPER_ADMIN (auth.config.ts 정책과 동일) */
export function isRootSuperAdmin(
  user: { role?: string | null; email?: string | null } | null | undefined
): boolean {
  return (
    user?.role === "SUPER_ADMIN" && (user.email ?? "").trim().toLowerCase() === "root"
  );
}

export function rootForbiddenResponse(session: Session | null): NextResponse | null {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isRootSuperAdmin(session.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}
