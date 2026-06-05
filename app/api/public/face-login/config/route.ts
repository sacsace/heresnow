export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

/** 비로그인: 안면 로그인 UI — 회사명 입력 후 카메라 시작 */
export async function GET() {
  return NextResponse.json({ requireCompanyName: true });
}
