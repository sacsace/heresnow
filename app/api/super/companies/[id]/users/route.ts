export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth } from "@/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/passwordPolicy";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  email: z.string().email().transform((e) => e.toLowerCase().trim()),
  name: z.string().min(1).max(120),
  password: z.string().min(MIN_PASSWORD_LENGTH).max(200),
  role: z.enum(["COMPANY_ADMIN", "HR_MANAGER", "APPROVER", "EMPLOYEE", "DOOR"]),
});

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId } = await ctx.params;
  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { id: true } });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const users = await prisma.user.findMany({
    where: { companyId },
    orderBy: { email: "asc" },
    select: {
      id: true,
      email: true,
      role: true,
      consentGivenAt: true,
      createdAt: true,
      employee: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({ users });
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: companyId } = await ctx.params;

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

  const { email, name, password, role } = parsed.data;

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
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
    console.error("[super companies users POST]", e);
    return NextResponse.json({ error: "생성 실패" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
