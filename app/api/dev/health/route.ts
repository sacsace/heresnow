import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/** 개발 전용: 로컬에서 DB 연결·시드 여부 확인 (프로덕션에서는 비활성) */
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    const users = await prisma.user.count();
    return NextResponse.json({ ok: true as const, users });
  } catch {
    return NextResponse.json(
      { ok: false as const, code: "DATABASE_UNREACHABLE" as const },
      { status: 503 }
    );
  }
}
