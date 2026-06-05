export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;

  const tier = await prisma.pricingTier.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          billingRequestsTarget: true,
          companiesAsCurrent: true,
        },
      },
    },
  });

  if (!tier) {
    return NextResponse.json({ error: "구간을 찾을 수 없습니다." }, { status: 404 });
  }

  if (tier._count.billingRequestsTarget > 0) {
    return NextResponse.json(
      {
        error:
          "업그레이드 요청에 연결된 구간은 삭제할 수 없습니다. 요청을 처리한 뒤 다시 시도하세요.",
      },
      { status: 409 }
    );
  }

  try {
    await prisma.pricingTier.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "구간 삭제에 실패했습니다." }, { status: 400 });
  }

  const inUse = tier._count.companiesAsCurrent;
  return NextResponse.json({
    ok: true,
    ...(inUse > 0
      ? {
          warning: `${inUse}개 회사의 현재 요금제 연결이 해제되었습니다.`,
        }
      : {}),
  });
}
