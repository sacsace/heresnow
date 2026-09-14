export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/** 비로그인: 안면 로그인 UI — 회사명은 선택 */
export async function GET() {
  return NextResponse.json({ requireCompanyName: false });
}
