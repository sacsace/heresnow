import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; userId: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId, userId } = await ctx.params;

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true, employee: { select: { id: true } } },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!user.employee) {
    return NextResponse.json({ error: "Employee record not found" }, { status: 404 });
  }

  const name = parsed.data.name.trim();
  const employee = await prisma.employee.update({
    where: { id: user.employee.id },
    data: { name },
    select: { id: true, name: true },
  });

  return NextResponse.json({ employee });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; userId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId, userId } = await ctx.params;

  // 자기 자신은 이 페이지에서 다루는 회사 사용자(SUPER_ADMIN은 companyId가 null)
  // 가 아니지만 안전망으로 추가 차단한다.
  if (session.user.id === userId) {
    return NextResponse.json(
      { error: "본인 계정은 삭제할 수 없습니다." },
      { status: 400 }
    );
  }

  const target = await prisma.user.findFirst({
    where: { id: userId, companyId },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // User → Employee → AttendanceRecord, ApprovalLog 등은 onDelete: Cascade 로 자동 정리.
  await prisma.user.delete({ where: { id: target.id } });

  return NextResponse.json({ ok: true });
}
