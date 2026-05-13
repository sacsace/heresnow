import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (
    role !== "COMPANY_ADMIN" &&
    role !== "HR_MANAGER" &&
    role !== "APPROVER" &&
    role !== "SUPER_ADMIN"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let companyId = session.user.companyId;
  if (role === "SUPER_ADMIN") {
    const q = new URL(req.url).searchParams.get("companyId");
    if (!q) {
      return NextResponse.json({ error: "companyId required" }, { status: 400 });
    }
    companyId = q;
  }

  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  const employees = await prisma.employee.findMany({
    where: { companyId },
    orderBy: { name: "asc" },
    include: { user: { select: { email: true, role: true } } },
  });

  return NextResponse.json({ employees });
}

const postSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  name: z.string().min(1).max(120),
  password: z.string().min(8).max(200),
});

/** 직원 추가 (좌석 상한 seatLimit 적용) */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "COMPANY_ADMIN" && session.user.role !== "HR_MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const companyId = session.user.companyId;
  if (!companyId) {
    return NextResponse.json({ error: "No company" }, { status: 400 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, password } = parsed.data;
  const role = Role.EMPLOYEE;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const count = await prisma.employee.count({ where: { companyId } });
  if (count >= company.seatLimit) {
    return NextResponse.json(
      { error: `좌석 상한(${company.seatLimit}명)에 도달했습니다. 요금제를 상향하세요.` },
      { status: 403 }
    );
  }

  const dup = await prisma.user.findUnique({ where: { email } });
  if (dup) {
    return NextResponse.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          companyId,
          email,
          passwordHash,
          role,
          consentGivenAt: null,
          consentVersion: null,
        },
      });
      await tx.employee.create({
        data: { companyId, userId: user.id, name: name.trim() },
      });
    });
  } catch (e) {
    console.error("[employees POST]", e);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
