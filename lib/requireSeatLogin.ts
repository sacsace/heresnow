import type { Session } from "next-auth";
import { isUserSeatLoginAllowed } from "@/lib/seatAccess";
import { NextResponse } from "next/server";

/** 직원 API — 좌석 밖이면 403 */
export async function seatLoginForbiddenResponse(
  session: Session | null
): Promise<NextResponse | null> {
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const allowed = await isUserSeatLoginAllowed({
    role: session.user.role,
    companyId: session.user.companyId,
    employeeId: session.user.employeeId,
  });

  if (!allowed) {
    return NextResponse.json(
      {
        error: "SEAT_LIMIT",
        message: "로그인 좌석이 배정되지 않았습니다. 관리자에게 문의하세요.",
      },
      { status: 403 }
    );
  }

  return null;
}
