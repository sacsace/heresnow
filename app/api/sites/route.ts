import { auth } from "@/auth";
import { NextResponse } from "next/server";

/** 호환용. HereNow는 근무지 없이 GPS만으로 출퇴근합니다. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id || !session.user.companyId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ sites: [] });
}
