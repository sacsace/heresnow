export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { faceLoginRequiresCompanyName } from "@/lib/resolveFaceLoginCompany";
import { NextResponse } from "next/server";

/** 비로그인: 안면 로그인 UI — 회사명 입력 필요 여부 */
export async function GET() {
  try {
    const requireCompanyName = await faceLoginRequiresCompanyName();
    return NextResponse.json({ requireCompanyName });
  } catch {
    return NextResponse.json({ requireCompanyName: true }, { status: 500 });
  }
}
